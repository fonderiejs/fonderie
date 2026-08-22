import type { ICreateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseWorkspacesReturn {
	workspaces: Ref<IWorkspaceDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
	acceptInvitation: (pin: string) => Promise<string>;
}

export function useWorkspaces(client?: WorkspacesClient): IUseWorkspacesReturn {
	const workspacesClient = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaces');
	const workspaces = ref<IWorkspaceDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspacesClient.listWorkspaces({ bust: opts?.force });
			workspaces.value = result.workspaces;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());

	async function createWorkspace(input: ICreateWorkspaceInput) {
		error.value = null;
		try {
			const { result } = await workspacesClient.createWorkspace(input);
			await refresh();
			return result.workspace;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function acceptInvitation(pin: string) {
		error.value = null;
		try {
			const { result } = await workspacesClient.acceptInvitation(pin);
			await refresh();
			return result.workspaceId;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { workspaces, isLoading, error, refresh, createWorkspace, acceptInvitation };
}
