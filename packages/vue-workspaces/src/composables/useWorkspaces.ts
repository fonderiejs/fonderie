import type { IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useWorkspaces(client?: WorkspacesClient) {
	const workspacesClient = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaces');
	const workspaces = ref<IWorkspaceDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspacesClient.listWorkspaces();
			workspaces.value = result.workspaces;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { workspaces, isLoading, error, refresh };
}
