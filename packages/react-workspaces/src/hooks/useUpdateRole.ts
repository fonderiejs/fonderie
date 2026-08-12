import type { IRoleDTO, IUpdateRoleInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseUpdateRoleReturn {
	updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useUpdateRole(client: WorkspacesClient): IUseUpdateRoleReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const updateRole = useCallback(
		async (roleId: string, input: IUpdateRoleInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.updateRole(roleId, input);
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
		[client],
	);

	return { updateRole, isLoading, error };
}
