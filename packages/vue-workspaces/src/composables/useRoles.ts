import type { FonderieApiError, IRoleDTO, IRoleDeleteResult, ICreateRoleInput, IUpdateRoleInput, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseRolesReturn {
	roles: Ref<IRoleDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
	createRole: (input: ICreateRoleInput) => Promise<IRoleDTO>;
	/** Resolves with how many members held it, and how many moved to the default role. */
	removeRole: (roleId: string) => Promise<IRoleDeleteResult>;
}

const NONE: IRoleDTO[] = [];

// The selected workspace's roles — re-read on a workspace switch.
export function useRoles(client?: WorkspacesClient): IUseRolesReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useRoles');
	const q = useScopedQuery(workspaces, '/workspaces/roles', async (bust) => (await workspaces.listRoles({ bust })).result.roles);
	const w = useWrite(() => q.refresh());
	return {
		roles: computed(() => q.data.value ?? NONE),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		updateRole: (roleId, input) => w.run(async () => (await workspaces.updateRole(roleId, input)).result.role),
		createRole: (input) => w.run(async () => (await workspaces.createRole(input)).result.role),
		removeRole: (roleId) => w.run(async () => (await workspaces.removeRole(roleId)).result),
	};
}
