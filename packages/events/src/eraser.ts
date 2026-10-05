import { constantTimeEqual } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { computeEventHmac } from './integrity';

/** The person being erased, as the account-deletion purge describes them. */
export interface IEventsErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface IEventsErasureResult {
	/** Event rows deleted or redacted. 0 on a repeat run. */
	erased: number;
	/** What was deliberately kept, and why — absent when nothing was. */
	kept?: string;
}

/** The shape the account-deletion purge calls, in-process, before the user row goes. */
export interface IEventsAccountEraser {
	readonly name: 'events';
	erase(subject: IEventsErasureSubject): Promise<IEventsErasureResult>;
}

export interface IEventsEraserOptions {
	/**
	 * The key the event log is signed with — the SAME value given to the PG
	 * transport's `integrityKey`. A redacted row is re-signed with it so the
	 * integrity check keeps reporting it intact. Required as soon as a row that
	 * must be redacted carries an HMAC; without it the eraser throws rather than
	 * leave a row that reads as tampered.
	 */
	integrityKey?: string;
	/** Keys the log was signed with before a rotation — used only to VERIFY a row before re-signing it. */
	retiredIntegrityKeys?: readonly string[];
}

/** What a redacted value reads as. */
export const ERASED_VALUE = 'erased';

const NOTIFICATION = 'fonderie.notification.send';

// Fields that describe the account a payload is about (`payload.userId`). Only
// read at the top level of such a payload: nested objects may describe someone
// else, and are redacted only where they carry the person's own address.
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

// The SQL twins of emailKey/phoneKey, applied to a JSON text value.
const SQL_EMAIL_KEY = (v: string) => `lower(regexp_replace(btrim(${v}), '[+][^@]*@', '@'))`;
const SQL_PHONE_KEY = (v: string) => `regexp_replace(${v}, '[[:space:]().-]', '', 'g')`;

// created_at to the microsecond, as fixed-width UTC text: ordered as strings,
// and parsed back by Postgres without loss. (A JS Date keeps milliseconds, so
// a cut-off read into one falls BEFORE the row it was read from.)
const EXACT_TIME = `to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function escapeLike(s: string): string {
	return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface EventRow {
	id: string;
	type: string;
	payload: unknown;
	meta: Record<string, unknown>;
	hmac: string | null;
	/** created_at, as EXACT_TIME renders it. */
	at: string;
}

/**
 * Erase a person from the event log at account purge.
 *
 * The event log is also the audit trail (SOC 2 needs the security trail; GDPR
 * needs the person's data gone — design D8). So:
 *
 * - **Notifications addressed to the person are deleted** —
 *   `fonderie.notification.send` rows whose `recipient.email` (any case, any
 *   '+tag') or `recipient.phone` is theirs. They are deliveries, not audit, and
 *   carry one-time codes, reset links and names. Their addresses include the
 *   ones the account had BEFORE — every earlier address an `email-changed`
 *   notice links to the current one, and the one it registered with
 *   (`fonderie.user.registered`, by user id) — each only up to the moment the
 *   account moved off it, since a freed address may now be someone else's.
 *   Deleting a row leaves the
 *   integrity check intact (it is per-row; see `verifyEventChain`).
 * - **Every other event that names the person is redacted, not deleted** — the
 *   personal fields of a payload about them (`payload.userId` is theirs:
 *   email, phone, first/last name …) and any value anywhere holding one of their
 *   addresses become `'erased'`; the opaque `userId` stays, so the security
 *   trail by pseudonymous id survives. `meta.erasedAt` records when. A signed
 *   row is re-signed with `integrityKey` — after its CURRENT signature is
 *   verified, so erasure can never launder a tampered row.
 *
 * Throws (the purge keeps the account archived and retries) when a
 * notification to the person has not finished delivering — deleting it would
 * cancel a message still on its way, the final notice included; when a row to
 * redact is signed but no `integrityKey` was given; and when such a row fails
 * its integrity check.
 *
 * One transaction. Idempotent: a second run finds nothing and returns `{ erased: 0 }`.
 *
 * Cost: finding addresses inside payloads scans the event log's text once per
 * erased account — fine for a daily purge; keep the log under a retention
 * policy (`startEventRetention`) so it stays bounded.
 */
export function accountEraser(store: IStoreAdapter, options: IEventsEraserOptions = {}): IEventsAccountEraser {
	const key = options.integrityKey || undefined;
	const verifyKeys = [key, ...(options.retiredIntegrityKeys ?? [])].filter(
		(k): k is string => typeof k === 'string' && k !== '',
	);

	return {
		name: 'events',
		async erase({ userId, email, phone }) {
			return store.transaction(async (tx) => {
				// Every email address that was theirs, and until when: `null` = still
				// theirs (the current one). A previous address is theirs only up to the
				// moment the account moved off it — after that it is free, and someone
				// else may have registered it; their messages are not ours to erase.
				const emails = new Map<string, string | null>();
				const own = email ? emailKey(email) : null;
				if (own) emails.set(own, null);
				const phones = new Set<string>();
				const ownPhone = phone ? phoneKey(phone) : null;
				if (ownPhone) phones.add(ownPhone);
				const extend = (address: string, until: string): boolean => {
					if (!emails.has(address)) {
						emails.set(address, until);
						return true;
					}
					const was = emails.get(address);
					if (was === null || (was && was >= until)) return false;
					emails.set(address, until);
					return true;
				};
				const heldAt = (address: string, at: string): boolean => {
					if (!emails.has(address)) return false;
					const until = emails.get(address);
					return until === null || (until !== undefined && at <= until);
				};

				// Walk back along the email-changed notices — each is sent to the
				// PREVIOUS address and names the new one — until no new address appears.
				for (let round = 0; round < 20 && emails.size > 0; round++) {
					const changes = await tx.query<{ previous: string | null; next: string | null; at: string }>(
						`SELECT payload->'recipient'->>'email' AS previous, payload->'data'->>'newEmail' AS next,
						        ${EXACT_TIME} AS at
						   FROM fonderie_events
						  WHERE type = $1
						    AND payload->>'type' = 'email-changed'
						    AND ${SQL_EMAIL_KEY(`payload->'data'->>'newEmail'`)} = ANY($2::text[])`,
						[NOTIFICATION, [...emails.keys()]],
					);
					let grew = false;
					for (const c of changes) {
						const next = c.next ? emailKey(c.next) : null;
						const previous = c.previous ? emailKey(c.previous) : null;
						// The move counts only while the new address was already theirs.
						if (!next || !previous || !heldAt(next, c.at)) continue;
						grew = extend(previous, c.at) || grew;
					}
					if (!grew) break;
				}
				// The address the account registered with, if no change notice
				// reached it: theirs at least for the registration itself.
				const registered = await tx.query<{ email: string | null; at: string }>(
					`SELECT payload->>'email' AS email, ${EXACT_TIME} AS at FROM fonderie_events
					  WHERE type = 'fonderie.user.registered' AND payload->>'userId' = $1`,
					[userId],
				);
				for (const r of registered) {
					const k = r.email ? emailKey(r.email) : null;
					if (k) extend(k, r.at);
				}

				const addresses = [...emails.keys()];
				const untils = addresses.map((a) => emails.get(a) ?? null);
				const phoneList = [...phones];
				const addressedToThem = `type = $1 AND (
					(payload->'recipient'->>'email' IS NOT NULL AND EXISTS (
					   SELECT 1 FROM unnest($2::text[], $3::timestamptz[]) AS a(address, upto)
					    WHERE ${SQL_EMAIL_KEY(`payload->'recipient'->>'email'`)} = a.address
					      AND (a.upto IS NULL OR created_at <= a.upto)))
					OR (payload->'recipient'->>'phone' IS NOT NULL
					 AND ${SQL_PHONE_KEY(`payload->'recipient'->>'phone'`)} = ANY($4::text[])))`;
				const params = [NOTIFICATION, addresses, untils, phoneList];

				// ── 1. Notifications to them: delivered (or given up on) → deleted ──
				const [inFlight] = await tx.query<{ n: number }>(
					`WITH theirs AS (SELECT id FROM fonderie_events WHERE ${addressedToThem})
					 SELECT count(DISTINCT c.event_id)::int AS n
					   FROM fonderie_event_consumers c JOIN theirs ON theirs.id = c.event_id
					  WHERE c.status IN ('pending', 'processing', 'failed')`,
					params,
				);
				if ((inFlight?.n ?? 0) > 0) {
					throw new Error(
						`events: ${inFlight!.n} notification(s) to this person are still being delivered; ` +
							`erasing them would cancel the send — retry once the outbox has drained`,
					);
				}
				const deleted = await tx.query<{ id: string }>(
					`DELETE FROM fonderie_events WHERE ${addressedToThem} RETURNING id`,
					params,
				);

				// ── 2. Everything else naming them: redacted in place, re-signed ──
				// Candidates are found generously (a payload ABOUT them, or whose text
				// contains one of their addresses' parts); the exact match is decided
				// below, value by value, so nothing is redacted on a text coincidence.
				const likes = addresses.map((e) => {
					const at = e.indexOf('@');
					return `%${escapeLike(e.slice(0, at))}%@${escapeLike(e.slice(at + 1))}%`;
				});
				const candidates = await tx.query<EventRow>(
					`SELECT id, type, payload, meta, hmac, ${EXACT_TIME} AS at FROM fonderie_events
					  WHERE payload->>'userId' = $1
					     OR lower(payload::text) LIKE ANY($2::text[])
					     OR EXISTS (SELECT 1 FROM unnest($3::text[]) p
					                 WHERE strpos(${SQL_PHONE_KEY('payload::text')}, p) > 0)
					  ORDER BY created_at, id
					  FOR UPDATE`,
					[userId, likes, phoneList],
				);

				const isTheirs = (value: string, at: string): boolean => {
					if (phones.size > 0) {
						for (const token of value.match(PHONE_IN_TEXT) ?? []) {
							const p = phoneKey(token);
							if (p && phones.has(p)) return true;
						}
					}
					if (emails.size === 0 || !value.includes('@')) return false;
					for (const token of value.match(ADDRESS_IN_TEXT) ?? []) {
						const k = emailKey(token);
						if (k && heldAt(k, at)) return true;
					}
					return false;
				};
				const scrub = (value: unknown, at: string): unknown => {
					if (typeof value === 'string') return value !== ERASED_VALUE && isTheirs(value, at) ? ERASED_VALUE : value;
					if (Array.isArray(value)) return value.map((v) => scrub(v, at));
					if (value && typeof value === 'object') {
						const out: Record<string, unknown> = {};
						for (const [k, v] of Object.entries(value)) out[k] = scrub(v, at);
						return out;
					}
					return value;
				};

				let redacted = 0;
				const erasedAt = new Date().toISOString();
				for (const row of candidates) {
					let payload = scrub(row.payload, row.at);
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
					if (JSON.stringify(payload) === JSON.stringify(row.payload)) continue; // nothing of theirs

					let hmac: string | null = null;
					if (row.hmac !== null) {
						if (!key) {
							throw new Error(
								`events: event ${row.id} is signed but no integrityKey was given to the eraser — ` +
									`pass the transport's integrityKey so the redacted row can be re-signed`,
							);
						}
						const signedBy = verifyKeys.some((k) => constantTimeEqual(computeEventHmac(k, row), row.hmac as string));
						if (!signedBy) {
							throw new Error(
								`events: event ${row.id} fails its integrity check — refusing to re-sign it ` +
									`(that would hide the tampering); investigate before erasing`,
							);
						}
					}
					const meta = { ...row.meta, erasedAt };
					if (row.hmac !== null) hmac = computeEventHmac(key as string, { id: row.id, type: row.type, payload, meta });
					await tx.query(`UPDATE fonderie_events SET payload = $2, meta = $3, hmac = $4 WHERE id = $1`, [
						row.id,
						JSON.stringify(payload),
						JSON.stringify(meta),
						hmac,
					]);
					redacted += 1;
				}

				const result: IEventsErasureResult = { erased: deleted.length + redacted };
				if (redacted > 0) {
					result.kept =
						`${redacted} event(s) kept with personal fields redacted and the opaque user id ` +
						`intact — the security/audit trail` +
						(key ? '; signed rows re-signed' : '');
				}
				return result;
			});
		},
	};
}
