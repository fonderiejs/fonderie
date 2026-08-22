import type { AuthClient, ILoginInput, ILoginResult, IMfaRequiredResult } from '@fonderie/client';
import { FonderieApiError, isMfaRequired } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { persistToken } from '../storage';

export interface IUseLoginReturn {
	login: (input: ILoginInput) => Promise<ILoginResult | IMfaRequiredResult>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	data: Ref<ILoginResult | null>;
	// Set when the account requires MFA: no tokens were issued — complete the
	// login with client.auth.mfa.verifyLogin(mfaPending.value.mfaToken, code).
	mfaPending: Ref<IMfaRequiredResult | null>;
}

export function useLogin(client?: AuthClient): IUseLoginReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useLogin');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const data = ref<ILoginResult | null>(null);
	// Set when the account requires MFA: complete the login with
	// client.auth.mfa.verifyLogin(mfaPending.value.mfaToken, code).
	const mfaPending = ref<IMfaRequiredResult | null>(null);

	async function login(input: ILoginInput) {
		isLoading.value = true;
		error.value = null;
		mfaPending.value = null;
		try {
			const { result } = await auth.login(input);
			if (isMfaRequired(result)) {
				mfaPending.value = result;
				return result;
			}
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

	return { login, isLoading, error, data, mfaPending };
}
