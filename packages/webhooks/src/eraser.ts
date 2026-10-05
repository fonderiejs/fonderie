import type { IStoreAdapter } from '@fonderie/store';

/** The person being erased, as the account-deletion purge describes them. */
export interface IWebhooksErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface IWebhooksErasureResult {
	/** Delivery rows redacted. 0 on a repeat run. */
	erased: number;
	/** What was deliberately kept, and why — absent when nothing was. */
	kept?: string;
}

/** The shape the account-deletion purge calls, in-process, before the user row goes. */
export interface IWebhooksAccountEraser {
	readonly name: 'webhooks';
	erase(subject: IWebhooksErasureSubject): Promise<IWebhooksErasureResult>;
}

/** What a redacted value reads as. */
export const ERASED_VALUE = 'erased';

// Fields that describe the account a payload is about (`payload.userId`), read
// at the top level only — nested objects may describe someone else and are
// redacted only where they carry the person's own address.
const PERSONAL_KEYS = new Set([
	'email',
	'phone',
	'firstName',
	'lastName',
	'fullName',
	'displayName',
	'newEmail',
	'oldEmail',
	'previousEmail',
]);

/** lowercase, '+tag' dropped from the local part — the account rule. */
function emailKey(email: string): string | null {
	const lower = email.trim().toLowerCase();
	const at = lower.indexOf('@');
	if (at <= 0 || at !== lower.lastIndexOf('@') || at === lower.length - 1) return null;
	const local = lower.slice(0, at);
	const plus = local.indexOf('+');
	const bare = plus === -1 ? local : local.slice(0, plus);
	return bare ? `${bare}@${lower.slice(at + 1)}` : null;
}

function phoneKey(phone: string): string | null {
	const bare = phone.replace(/[\s\-().]/g, '');
	return /^\+?\d{6,}$/.test(bare) ? bare : null;
}

const ADDRESS_IN_TEXT = /[^\s<>"',;:()[\]]+@[^\s<>"',;:()[\]]+/g;
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{4,}\d/g;
const SQL_PHONE_TEXT = (v: string) => `regexp_replace(${v}, '[[:space:]().-]', '', 'g')`;

function escapeLike(s: string): string {
	return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface DeliveryRow {
	id: string;
	payload: unknown;
	response_body: string | null;
}

/**
 * Erase a person from webhook delivery records at account purge.
 *
 * `fonderie_webhook_deliveries.payload` is a copy of an event payload sent to a
 * customer's endpoint, and `response_body` is whatever that endpoint answered
 * (it may echo the payload). Rows that name the person keep their place — ids,
 * event type, status, attempts and timestamps are the delivery record — but:
 *
 * - in a payload about them (`payload.userId` is theirs) the personal fields
 *   (email, phone, first/last name …) become `'erased'`; the opaque `userId` stays;
 * - any value anywhere in the payload that holds their email (any case, any
 *   '+tag') or phone becomes `'erased'`;
 * - a response body that contains their email or phone becomes `'erased'`.
 *
 * What was already sent to a customer's endpoint is in THEIR system; erasing it
 * there is theirs to do. One transaction. Idempotent: a second run finds
 * nothing and returns `{ erased: 0 }`.
 */
export function accountEraser(store: IStoreAdapter): IWebhooksAccountEraser {
	return {
		name: 'webhooks',
		async erase({ userId, email, phone }) {
			const own = email ? emailKey(email) : null;
			const ownPhone = phone ? phoneKey(phone) : null;

			const isTheirs = (value: string): boolean => {
				if (ownPhone) {
					for (const token of value.match(PHONE_IN_TEXT) ?? []) {
						if (phoneKey(token) === ownPhone) return true;
					}
				}
				if (!own || !value.includes('@')) return false;
				for (const token of value.match(ADDRESS_IN_TEXT) ?? []) {
					if (emailKey(token) === own) return true;
				}
				return false;
			};
			const scrub = (value: unknown): unknown => {
				if (typeof value === 'string') return value !== ERASED_VALUE && isTheirs(value) ? ERASED_VALUE : value;
				if (Array.isArray(value)) return value.map(scrub);
				if (value && typeof value === 'object') {
					const out: Record<string, unknown> = {};
					for (const [k, v] of Object.entries(value)) out[k] = scrub(v);
					return out;
				}
				return value;
			};

			const like = own ? `%${escapeLike(own.slice(0, own.indexOf('@')))}%@${escapeLike(own.slice(own.indexOf('@') + 1))}%` : null;

			return store.transaction(async (tx) => {
				// Found generously (a payload about them, or text containing their
				// address' parts); the exact match is decided value by value below.
				const candidates = await tx.query<DeliveryRow>(
					`SELECT id, payload, response_body FROM fonderie_webhook_deliveries
					  WHERE payload->>'userId' = $1
					     OR ($2::text IS NOT NULL AND (lower(payload::text) LIKE $2 OR lower(response_body) LIKE $2))
					     OR ($3::text IS NOT NULL AND (strpos(${SQL_PHONE_TEXT('payload::text')}, $3) > 0
					                                OR strpos(${SQL_PHONE_TEXT('response_body')}, $3) > 0))
					  ORDER BY created_at, id
					  FOR UPDATE`,
					[userId, like, ownPhone],
				);

				let erased = 0;
				for (const row of candidates) {
					let payload = scrub(row.payload);
					if (
						payload &&
						typeof payload === 'object' &&
						!Array.isArray(payload) &&
						(payload as Record<string, unknown>)['userId'] === userId
					) {
						const top = { ...(payload as Record<string, unknown>) };
						for (const k of Object.keys(top)) {
							if (PERSONAL_KEYS.has(k) && top[k] !== null && top[k] !== ERASED_VALUE) top[k] = ERASED_VALUE;
						}
						payload = top;
					}
					const body =
						row.response_body !== null && row.response_body !== ERASED_VALUE && isTheirs(row.response_body)
							? ERASED_VALUE
							: row.response_body;
					if (body === row.response_body && JSON.stringify(payload) === JSON.stringify(row.payload)) continue;

					await tx.query(`UPDATE fonderie_webhook_deliveries SET payload = $2, response_body = $3 WHERE id = $1`, [
						row.id,
						JSON.stringify(payload),
						body,
					]);
					erased += 1;
				}

				const result: IWebhooksErasureResult = { erased };
				if (erased > 0) {
					result.kept =
						`${erased} webhook delivery record(s) kept with personal fields redacted ` +
						`(ids, event type, status and timestamps are the delivery record); ` +
						`copies already delivered live in the receiving endpoints' systems`;
				}
				return result;
			});
		},
	};
}
