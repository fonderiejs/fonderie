import type { ConfigAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useDeleteSecret(client: ConfigAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function deleteSecret(key: string, environment?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await client.deleteSecret(key, environment);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { deleteSecret, isLoading, error };
}
