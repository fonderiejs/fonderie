import type { ICreateWorkspaceInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCreateWorkspace(client: WorkspacesClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function createWorkspace(input: ICreateWorkspaceInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.createWorkspace(input);
			return result.workspace;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { createWorkspace, isLoading, error };
}
