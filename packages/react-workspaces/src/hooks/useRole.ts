import type { IRoleDTO } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseRoleReturn {
	role: IRoleDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read hook for a single role. Writes live where their lists refresh:
// useRoles (create/update/remove) and useRolePermissions (permission set).
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
	const [role, setRole] = useState<IRoleDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.getRole(roleId, { bust: opts?.force });
				setRole(result.role);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[workspaces, roleId],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { role, isLoading, error, refresh };
}
