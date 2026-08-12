import type { IRoleDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseMemberRolesReturn {
	roles: IRoleDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addRole: (roleId: string) => Promise<void>;
	removeRole: (roleId: string) => Promise<void>;
}

export function useMemberRoles(client: WorkspacesClient, userId: string): IUseMemberRolesReturn {
	const [roles, setRoles] = useState<IRoleDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getMemberRoles(userId);
			setRoles(result.roles);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, userId]);

	const addRole = useCallback(
		async (roleId: string) => {
			setError(null);
			try {
				await client.addMemberRole(userId, roleId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, userId, refresh],
	);

	const removeRole = useCallback(
		async (roleId: string) => {
			setError(null);
			try {
				await client.removeMemberRole(userId, roleId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, userId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { roles, isLoading, error, refresh, addRole, removeRole };
}
