import type { ConfigAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useDeleteConfigEntry(client: ConfigAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function deleteConfigEntry(key: string, environment?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await client.deleteConfig(key, environment);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { deleteConfigEntry, isLoading, error };
}
