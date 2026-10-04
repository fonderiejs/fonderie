import type { FonderieApiError, IRolePermission, IRolePermissionInput } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseRolePermissionsReturn {
	permissions: IRolePermission[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Writes the full permission set for the role, then re-reads it — the
	// read/write pair lives in one hook so editors can pre-populate.
	setRolePermissions: (permissions: IRolePermissionInput[]) => Promise<void>;
}

const NONE: IRolePermission[] = [];

export function useRolePermissions(roleId: string): IUseRolePermissionsReturn;
export function useRolePermissions(
	client: WorkspacesClient | undefined,
	roleId: string,
): IUseRolePermissionsReturn;
export function useRolePermissions(
	clientOrId: WorkspacesClient | string | undefined,
	maybeId?: string,
): IUseRolePermissionsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const roleId = firstIsClient ? (maybeId as string) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useRolePermissions');
	const q = useScopedQuery(
		workspaces,
		`/workspaces/roles/${encodeURIComponent(roleId)}/permissions`,
		async (bust) => (await workspaces.getRolePermissions(roleId, { bust })).result.permissions,
		// No id yet (a screen still resolving it): wait, don't request '/…/'.
		{ enabled: !!roleId },
	);
	const w = useWrite(q.refresh);
	const setRolePermissions = useCallback(
		(input: IRolePermissionInput[]) =>
			w.run(async () => {
				await workspaces.setRolePermissions(roleId, input);
			}),
		[workspaces, roleId, w.run],
	);
	return { permissions: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, setRolePermissions };
}
