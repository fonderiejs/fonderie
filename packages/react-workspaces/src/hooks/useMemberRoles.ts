import type { IRoleDTO } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseMemberRolesReturn {
	roles: IRoleDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addRole: (roleId: string) => Promise<void>;
	removeRole: (roleId: string) => Promise<void>;
}

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
	const [roles, setRoles] = useState<IRoleDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await workspaces.getMemberRoles(userId);
			setRoles(result.roles);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [workspaces, userId]);

	const addRole = useCallback(
		async (roleId: string) => {
			setError(null);
			try {
				await workspaces.addMemberRole(userId, roleId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, userId, refresh],
	);

	const removeRole = useCallback(
		async (roleId: string) => {
			setError(null);
			try {
				await workspaces.removeMemberRole(userId, roleId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[workspaces, userId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { roles, isLoading, error, refresh, addRole, removeRole };
}
