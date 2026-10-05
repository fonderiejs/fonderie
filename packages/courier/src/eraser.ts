import type { IStoreAdapter } from '@fonderie/store';

/** The person being erased, as the account-deletion purge describes them. */
export interface ICourierErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface ICourierErasureResult {
	/** Message-log rows redacted. 0 on a repeat run. */
	erased: number;
	/** What was deliberately kept, and why — absent when nothing was. */
	kept?: string;
}

/** The shape the account-deletion purge calls, in-process, before the user row goes. */
export interface ICourierAccountEraser {
	readonly name: 'courier';
	erase(subject: ICourierErasureSubject): Promise<ICourierErasureResult>;
}

/** What a redacted recipient (and any error text that may quote it) reads as. */
export const ERASED_RECIPIENT = 'erased';

/**
 * The address the account is stored under: lowercase, '+tag' dropped from the
 * local part — the same rule @fonderie/auth applies, so a message sent to
 * `Ana+news@Acme.example` belongs to the account `ana@acme.example`.
 */
export function erasureEmailKey(email: string): string | null {
	const lower = email.trim().toLowerCase();
	const at = lower.indexOf('@');
	if (at <= 0 || at !== lower.lastIndexOf('@') || at === lower.length - 1) return null;
	const local = lower.slice(0, at);
	const plus = local.indexOf('+');
	const bare = plus === -1 ? local : local.slice(0, plus);
	return bare ? `${bare}@${lower.slice(at + 1)}` : null;
}

/** A phone without the separators people type: '+1 (555) 000-1234' → '+15550001234'. */
export function erasurePhoneKey(phone: string): string | null {
	const bare = phone.replace(/[\s\-().]/g, '');
	return bare.length > 0 ? bare : null;
}

/**
 * Erase a person from the message log at account purge.
 *
 * `fonderie_message_log.recipient` holds the raw address a message went to.
 * Rows sent to the person's email (any case, any '+tag' variant, bare or as
 * `Name <address>`) or phone keep their place — message type, channel, status,
 * timestamps and provider ids are delivery statistics, not personal — but the
 * recipient becomes `'erased'`, and so do `error` and `bounce_reason` when set,
 * because a provider's rejection text routinely quotes the address.
 *
 * Push rows are addressed to a device token, which the purge does not know and
 * nothing links to the account; those are not matched here.
 *
 * One UPDATE. Idempotent: a second run matches nothing (`'erased'` is neither
 * an email nor the phone) and returns `{ erased: 0 }`.
 */
export function accountEraser(store: IStoreAdapter): ICourierAccountEraser {
	return {
		name: 'courier',
		async erase({ email, phone }) {
			const emailKey = email ? erasureEmailKey(email) : null;
			const phoneKey = phone ? erasurePhoneKey(phone) : null;
			if (!emailKey && !phoneKey) return { erased: 0 };

			// The address part of the recipient: the <…> of 'Name <a@b>', else all of it.
			const address = `btrim(coalesce(substring(recipient from '<([^<>]+)>'), recipient))`;
			const rows = await store.query<{ id: string }>(
				`UPDATE fonderie_message_log
				    SET recipient     = $3,
				        error         = CASE WHEN error IS NULL THEN NULL ELSE $3 END,
				        bounce_reason = CASE WHEN bounce_reason IS NULL THEN NULL ELSE $3 END
				  WHERE ($1::text IS NOT NULL
				         AND position('@' in recipient) > 0
				         AND lower(regexp_replace(${address}, '[+][^@]*@', '@')) = $1)
				     OR ($2::text IS NOT NULL
				         AND position('@' in recipient) = 0
				         AND regexp_replace(recipient, '[[:space:]().-]', '', 'g') = $2)
				  RETURNING id`,
				[emailKey, phoneKey, ERASED_RECIPIENT],
			);

			const result: ICourierErasureResult = { erased: rows.length };
			if (rows.length > 0) {
				result.kept =
					`${rows.length} message-log row(s) kept with the recipient, error and bounce reason ` +
					`redacted — type, channel, status and timestamps are delivery statistics`;
			}
			return result;
		},
	};
}
