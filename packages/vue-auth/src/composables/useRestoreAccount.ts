import type { AuthClient, ILoginResult, IRestoreAccountInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { persistToken } from '../storage';

export interface IUseRestoreAccountReturn {
	// "Keep my account": the restoreToken from a sign-in that answered
	// ACCOUNT_PENDING_DELETION (read it with pendingDeletionOf(err)), plus
	// mfaCode when the account has two-factor on. Signs in like login.
	restore: (input: IRestoreAccountInput) => Promise<ILoginResult>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useRestoreAccount(client?: AuthClient): IUseRestoreAccountReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useRestoreAccount');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function restore(input: IRestoreAccountInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.restoreAccount(input);
			auth.setAccessToken(result.tokens.access);
			persistToken(result.tokens.access);
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { restore, isLoading, error };
}
