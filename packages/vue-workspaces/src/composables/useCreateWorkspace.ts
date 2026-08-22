import type { ICreateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCreateWorkspaceReturn {
	createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

/** @deprecated Use useWorkspaces().createWorkspace — the list hook self-refreshes after the write. */
export function useCreateWorkspace(client?: WorkspacesClient): IUseCreateWorkspaceReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useCreateWorkspace');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function createWorkspace(input: ICreateWorkspaceInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.createWorkspace(input);
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
