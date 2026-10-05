import type {
	FonderieApiError,
	ICreateRoleInput,
	IRoleDeleteResult,
	IRoleDTO,
	IUpdateRoleInput,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseRolesReturn {
	roles: IRoleDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createRole: (input: ICreateRoleInput) => Promise<IRoleDTO>;
	updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
	/** Resolves with how many members held it, and how many moved to the default role. */
	removeRole: (roleId: string) => Promise<IRoleDeleteResult>;
}

const NONE: IRoleDTO[] = [];

// The selected workspace's roles — re-read on a workspace switch.
export function useRoles(client?: WorkspacesClient): IUseRolesReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useRoles');
	const q = useScopedQuery(workspaces, '/workspaces/roles', async (bust) => (await workspaces.listRoles({ bust })).result.roles);
	const w = useWrite(q.refresh);
	const createRole = useCallback(
		(input: ICreateRoleInput) => w.run(async () => (await workspaces.createRole(input)).result.role),
		[workspaces, w.run],
	);
	const updateRole = useCallback(
		(roleId: string, input: IUpdateRoleInput) => w.run(async () => (await workspaces.updateRole(roleId, input)).result.role),
		[workspaces, w.run],
	);
	const removeRole = useCallback(
		(roleId: string) => w.run(async () => (await workspaces.removeRole(roleId)).result),
		[workspaces, w.run],
	);
	return { roles: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, createRole, updateRole, removeRole };
}
