import type { FonderieApiError, IRoleDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/react';

export interface IUseRoleReturn {
	role: IRoleDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read hook for a single role. Writes live where their lists refresh:
// useRoles (create/update/remove) and useRolePermissions (permission set) —
// and any of them marks this read stale too (same /workspaces resource).
export function useRole(roleId: string): IUseRoleReturn;
export function useRole(client: WorkspacesClient | undefined, roleId: string): IUseRoleReturn;
export function useRole(
	clientOrId: WorkspacesClient | string | undefined,
	maybeId?: string,
): IUseRoleReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const roleId = firstIsClient ? (maybeId as string) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useRole');
	const q = useScopedQuery(
		workspaces,
		`/workspaces/roles/${encodeURIComponent(roleId)}`,
		async (bust) => (await workspaces.getRole(roleId, { bust })).result.role,
		// No id yet (a screen still resolving it): wait, don't request '/…/'.
		{ enabled: !!roleId },
	);
	return { role: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
