import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseUnlinkOauthReturn {
	unlinkOauth: (provider: string) => Promise<void>;
	unlinked: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	// True when the server refused because the account has no password — the one
	// failure a settings screen should handle rather than just display, by
	// sending the user to set a password first. Surfaced as a flag so screens
	// don't have to match on the error's reason string.
	requiresPassword: boolean;
}

/**
 * Remove the OAuth provider linked to the signed-in account.
 *
 * Prefer gating the control on `user.hasPassword` so the case is never reached:
 * an account created BY the provider has no other credential, and unlinking it
 * would be account deletion. The server refuses regardless (409), which is what
 * `requiresPassword` reports.
 */
export function useUnlinkOauth(client?: AuthClient): IUseUnlinkOauthReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useUnlinkOauth');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const [unlinked, setUnlinked] = useState(false);
	const [requiresPassword, setRequiresPassword] = useState(false);

	const unlinkOauth = useCallback(
		async (provider: string) => {
			setIsLoading(true);
			setError(null);
			setRequiresPassword(false);
			try {
				await auth.unlinkOauth(provider);
				setUnlinked(true);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				setRequiresPassword(apiError.reason === 'PASSWORD_REQUIRED');
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[auth],
	);

	return { unlinkOauth, unlinked, isLoading, error, requiresPassword };
}
