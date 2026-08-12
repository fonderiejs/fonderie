import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useRemoveMember(client: WorkspacesClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function removeMember(userId: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await client.removeMember(userId);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { removeMember, isLoading, error };
}
