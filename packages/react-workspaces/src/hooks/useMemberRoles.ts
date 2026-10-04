import type { FonderieApiError, IRoleDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseMemberRolesReturn {
	roles: IRoleDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addRole: (roleId: string) => Promise<void>;
	removeRole: (roleId: string) => Promise<void>;
}

const NONE: IRoleDTO[] = [];

export function useMemberRoles(userId: string): IUseMemberRolesReturn;
export function useMemberRoles(
	client: WorkspacesClient | undefined,
	userId: string,
): IUseMemberRolesReturn;
export function useMemberRoles(
	clientOrId: WorkspacesClient | string | undefined,
	maybeId?: string,
): IUseMemberRolesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const userId = firstIsClient ? (maybeId as string) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useMemberRoles');
	const q = useScopedQuery(
		workspaces,
		`/workspaces/members/${encodeURIComponent(userId)}/roles`,
		async (bust) => (await workspaces.getMemberRoles(userId, { bust })).result.roles,
		// No id yet (a screen still resolving it): wait, don't request '/…/'.
		{ enabled: !!userId },
	);
	const w = useWrite(q.refresh);
	const addRole = useCallback(
		(roleId: string) =>
			w.run(async () => {
				await workspaces.addMemberRole(userId, roleId);
			}),
		[workspaces, userId, w.run],
	);
	const removeRole = useCallback(
		(roleId: string) =>
			w.run(async () => {
				await workspaces.removeMemberRole(userId, roleId);
			}),
		[workspaces, userId, w.run],
	);
	return { roles: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, addRole, removeRole };
}
