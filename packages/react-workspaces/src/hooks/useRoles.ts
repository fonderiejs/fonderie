import type {
	ICreateRoleInput,
	IRoleDTO,
	IUpdateRoleInput,
	WorkspacesClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseRolesReturn {
	roles: IRoleDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createRole: (input: ICreateRoleInput) => Promise<IRoleDTO>;
	updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
	removeRole: (roleId: string) => Promise<void>;
}

export function useRoles(client?: WorkspacesClient): IUseRolesReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useRoles');
	const [roles, setRoles] = useState<IRoleDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.listRoles({ bust: opts?.force });
				setRoles(result.roles);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[workspaces],
	);

	const createRole = useCallback(
		async (input: ICreateRoleInput) => {
			setError(null);
			try {
				const { result } = await workspaces.createRole(input);
				await refresh();
				return result.role;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, refresh],
	);

	const updateRole = useCallback(
		async (roleId: string, input: IUpdateRoleInput) => {
			setError(null);
			try {
				const { result } = await workspaces.updateRole(roleId, input);
				await refresh();
				return result.role;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, refresh],
	);

	const removeRole = useCallback(
		async (roleId: string) => {
			setError(null);
			try {
				await workspaces.removeRole(roleId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { roles, isLoading, error, refresh, createRole, updateRole, removeRole };
}
