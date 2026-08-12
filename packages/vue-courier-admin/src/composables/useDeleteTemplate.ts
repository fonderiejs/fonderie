import type { CourierAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useDeleteTemplate(client: CourierAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function deleteTemplate(type: string, locale?: string | null) {
		isLoading.value = true;
		error.value = null;
		try {
			await client.deleteTemplate(type, locale);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { deleteTemplate, isLoading, error };
}
