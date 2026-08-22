import type { IRolePermission, IRolePermissionInput } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseRolePermissionsReturn {
	permissions: IRolePermission[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Writes the full permission set for the role, then re-reads it — the
	// read/write pair lives in one hook so editors can pre-populate.
	setRolePermissions: (permissions: IRolePermissionInput[]) => Promise<void>;
}

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
	const [permissions, setPermissions] = useState<IRolePermission[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.getRolePermissions(roleId, { bust: opts?.force });
				setPermissions(result.permissions);
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

	const setRolePermissions = useCallback(
		async (input: IRolePermissionInput[]) => {
			setError(null);
			try {
				await workspaces.setRolePermissions(roleId, input);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, roleId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { permissions, isLoading, error, refresh, setRolePermissions };
}
