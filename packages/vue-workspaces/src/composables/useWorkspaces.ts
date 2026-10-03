import type { FonderieApiError, ICreateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseWorkspacesReturn {
	workspaces: Ref<IWorkspaceDTO[]>;
	/** Nothing to show yet — never true while a refresh runs behind data. */
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
	acceptInvitation: (pin: string) => Promise<string>;
}

const NONE: IWorkspaceDTO[] = [];

export function useWorkspaces(client?: WorkspacesClient): IUseWorkspacesReturn {
	const resolved = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaces');
	// The signed-in user's own list: the same whichever workspace is selected.
	const q = useScopedQuery(resolved, '/workspaces', async (bust) => (await resolved.listWorkspaces({ bust })).result.workspaces, {
		perWorkspace: false,
	});
	const w = useWrite(() => q.refresh());
	return {
		workspaces: computed(() => q.data.value ?? NONE),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		createWorkspace: (input) => w.run(async () => (await resolved.createWorkspace(input)).result.workspace),
		acceptInvitation: (pin) => w.run(async () => (await resolved.acceptInvitation(pin)).result.workspaceId),
	};
}
