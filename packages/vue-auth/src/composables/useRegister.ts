import type { AuthClient, IRegisterInput, IRegisterResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';
import { persistToken } from '../storage';

export function useRegister(client?: AuthClient) {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useRegister');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const data = ref<IRegisterResult | null>(null);

	async function register(input: IRegisterInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.register(input);
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

	return { register, isLoading, error, data };
}
