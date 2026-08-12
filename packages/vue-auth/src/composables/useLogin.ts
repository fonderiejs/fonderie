import type { AuthClient, ILoginInput, ILoginResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';
import { persistToken } from '../storage';

export function useLogin(client: AuthClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const data = ref<ILoginResult | null>(null);

	async function login(input: ILoginInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.login(input);
			client.setAccessToken(result.tokens.access);
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

	return { login, isLoading, error, data };
}
