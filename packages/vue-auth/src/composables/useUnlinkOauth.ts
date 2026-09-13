import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseUnlinkOauthReturn {
	unlinkOauth: (provider: string) => Promise<void>;
	unlinked: Ref<boolean>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	// True when the server refused because the account has no password — the one
	// failure a settings screen should handle rather than just display, by
	// sending the user to set a password first. A flag so screens don't have to
	// match on the error's reason string.
	requiresPassword: Ref<boolean>;
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
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const unlinked = ref(false);
	const requiresPassword = ref(false);

	const unlinkOauth = async (provider: string): Promise<void> => {
		isLoading.value = true;
		error.value = null;
		requiresPassword.value = false;
		try {
			await auth.unlinkOauth(provider);
			unlinked.value = true;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			requiresPassword.value = apiError.reason === 'PASSWORD_REQUIRED';
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	};

	return { unlinkOauth, unlinked, isLoading, error, requiresPassword };
}
