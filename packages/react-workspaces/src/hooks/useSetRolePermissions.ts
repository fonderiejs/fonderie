import type { IRolePermissionInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

/** @deprecated Use `useRolePermissions(roleId).setRolePermissions` instead — it re-reads the permission set after the write. */
export interface IUseSetRolePermissionsReturn {
	setRolePermissions: (roleId: string, permissions: IRolePermissionInput[]) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useRolePermissions(roleId).setRolePermissions` instead — it re-reads the permission set after the write. */
export function useSetRolePermissions(client?: WorkspacesClient): IUseSetRolePermissionsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useSetRolePermissions');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const setRolePermissions = useCallback(
		async (roleId: string, permissions: IRolePermissionInput[]) => {
			setIsLoading(true);
			setError(null);
			try {
				await workspaces.setRolePermissions(roleId, permissions);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[workspaces],
	);

	return { setRolePermissions, isLoading, error };
}
