import type { IRoleDTO, IUpdateRoleInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseUpdateRoleReturn {
	updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useUpdateRole(client?: WorkspacesClient): IUseUpdateRoleReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useUpdateRole');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const updateRole = useCallback(
		async (roleId: string, input: IUpdateRoleInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.updateRole(roleId, input);
				return result.role;
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

	return { updateRole, isLoading, error };
}
