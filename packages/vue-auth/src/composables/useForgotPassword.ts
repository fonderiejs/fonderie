import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useForgotPassword(client: AuthClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const sent = ref(false);

	async function forgotPassword(email: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await client.forgotPassword(email);
			sent.value = true;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { forgotPassword, isLoading, error, sent };
}
