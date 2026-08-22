import type { ICreateWorkspaceInput, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWorkspacesReturn {
	workspaces: IWorkspaceDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createWorkspace: (input: ICreateWorkspaceInput) => Promise<IWorkspaceDTO>;
	acceptInvitation: (pin: string) => Promise<string>;
}

export function useWorkspaces(client?: WorkspacesClient): IUseWorkspacesReturn {
	// Named `resolved` (not `workspaces`) to avoid shadowing the list state below.
	const resolved = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaces');
	const [workspaces, setWorkspaces] = useState<IWorkspaceDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await resolved.listWorkspaces({ bust: opts?.force });
				setWorkspaces(result.workspaces);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[resolved],
	);

	const createWorkspace = useCallback(
		async (input: ICreateWorkspaceInput) => {
			setError(null);
			try {
				const { result } = await resolved.createWorkspace(input);
				await refresh();
				return result.workspace;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[resolved, refresh],
	);

	const acceptInvitation = useCallback(
		async (pin: string) => {
			setError(null);
			try {
				const { result } = await resolved.acceptInvitation(pin);
				await refresh();
				return result.workspaceId;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[resolved, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { workspaces, isLoading, error, refresh, createWorkspace, acceptInvitation };
}
