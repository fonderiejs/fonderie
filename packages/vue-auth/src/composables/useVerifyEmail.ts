import type { AuthClient, IVerifyEmailResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useVerifyEmail(client?: AuthClient) {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useVerifyEmail');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const data = ref<IVerifyEmailResult | null>(null);

	async function verifyEmail(pin: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await auth.verifyEmail(pin);
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

	return { verifyEmail, isLoading, error, data };
}
