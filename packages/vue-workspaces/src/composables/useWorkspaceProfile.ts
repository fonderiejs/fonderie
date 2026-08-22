import type { IUpdateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseWorkspaceProfileReturn {
	updateWorkspace: (input: IUpdateWorkspaceInput) => Promise<IWorkspaceDTO>;
	archiveWorkspace: () => Promise<void>;
	restoreWorkspace: () => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

// Action-only, like useUpdateRole — there's no "get current workspace"
// route (only getWorkspace(id) for admin/cross-workspace lookups), so the
// caller already has the workspace object from useWorkspaces()'s list.
export function useWorkspaceProfile(client?: WorkspacesClient): IUseWorkspaceProfileReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceProfile');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function updateWorkspace(input: IUpdateWorkspaceInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.updateWorkspace(input);
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
			await workspaces.archiveWorkspace();
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
			await workspaces.restoreWorkspace();
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
