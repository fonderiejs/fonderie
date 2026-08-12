import type { IRolePermissionInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseSetRolePermissionsReturn {
	setRolePermissions: (roleId: string, permissions: IRolePermissionInput[]) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useSetRolePermissions(client: WorkspacesClient): IUseSetRolePermissionsReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const setRolePermissions = useCallback(
		async (roleId: string, permissions: IRolePermissionInput[]) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.setRolePermissions(roleId, permissions);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[client],
	);

	return { setRolePermissions, isLoading, error };
}
