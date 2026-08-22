import type { AuthClient, ILoginResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { persistToken } from '../storage';

export interface IUseMfaLoginReturn {
	// Completes a login that returned MFA_REQUIRED: verifies the TOTP code
	// against the temporary mfaToken from useLogin's mfaPending, then persists
	// the issued tokens exactly like a normal login.
	verifyLogin: (mfaToken: string, code: string) => Promise<ILoginResult>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	data: Ref<ILoginResult | null>;
}

export function useMfaLogin(client?: AuthClient): IUseMfaLoginReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useMfaLogin');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const data = ref<ILoginResult | null>(null);

	async function verifyLogin(mfaToken: string, code: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.mfa.verifyLogin(mfaToken, code);
			auth.setAccessToken(result.tokens.access);
			persistToken(result.tokens.access);
			data.value = result;
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

	return { verifyLogin, isLoading, error, data };
}
