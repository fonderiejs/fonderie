import { FonderieApiError } from './http';

/** What a sign-in to an ARCHIVED account answers (ACCOUNT_PENDING_DELETION, 403). */
export interface IPendingDeletion {
	requestedAt: string;
	/** When the account is permanently deleted (ISO instant). */
	deleteOn: string;
	/** Pass to auth.restoreAccount() — "Keep my account". Short-lived. */
	restoreToken: string;
	/** Two-factor is on: restoring needs a code from the authenticator (or a backup code). */
	mfaRequired: boolean;
}

/**
 * The deletion schedule a sign-in refusal carries, or null when the error is
 * anything else (including the sign-up 409, which has no dates and no token):
 *
 *   try { await login(...) } catch (err) {
 *     const pending = pendingDeletionOf(err);
 *     if (pending) showKeepMyAccount(pending);
 *   }
 */
export function pendingDeletionOf(err: unknown): IPendingDeletion | null {
	if (!(err instanceof FonderieApiError) || err.reason !== 'ACCOUNT_PENDING_DELETION' || err.status !== 403) return null;
	const d = (err.details ?? {}) as Record<string, unknown>;
	if (typeof d['restoreToken'] !== 'string' || typeof d['deleteOn'] !== 'string') return null;
	return {
		requestedAt: typeof d['requestedAt'] === 'string' ? d['requestedAt'] : '',
		deleteOn: d['deleteOn'],
		restoreToken: d['restoreToken'],
		mfaRequired: d['mfaRequired'] === true,
	};
}
