import type { IUpdateWorkspaceInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// Action-only, like useUpdateRole — there's no "get current workspace"
// route (only getWorkspace(id) for admin/cross-workspace lookups), so the
// caller already has the workspace object from useWorkspaces()'s list.
export function useWorkspaceProfile(client: WorkspacesClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function updateWorkspace(input: IUpdateWorkspaceInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.updateWorkspace(input);
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

	// Personal workspaces can't be archived — the server returns 403; surfaced via `error`.
	async function archiveWorkspace() {
		isLoading.value = true;
		error.value = null;
		try {
			await client.archiveWorkspace();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function restoreWorkspace() {
		isLoading.value = true;
		error.value = null;
		try {
			await client.restoreWorkspace();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { updateWorkspace, archiveWorkspace, restoreWorkspace, isLoading, error };
}
