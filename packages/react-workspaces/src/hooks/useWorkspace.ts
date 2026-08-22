import type { IWorkspaceDTO } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWorkspaceReturn {
	workspace: IWorkspaceDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read hook for an explicit workspace id (admin/cross-workspace lookups).
// Mutations on the CURRENT workspace live in useWorkspaceProfile — they act on
// the client's workspace scope, not on this id, so they deliberately don't
// fold here.
export function useWorkspace(workspaceId: string): IUseWorkspaceReturn;
export function useWorkspace(
	client: WorkspacesClient | undefined,
	workspaceId: string,
): IUseWorkspaceReturn;
export function useWorkspace(
	clientOrId: WorkspacesClient | string | undefined,
	maybeId?: string,
): IUseWorkspaceReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const workspaceId = firstIsClient ? (maybeId as string) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useWorkspace');
	const [workspace, setWorkspace] = useState<IWorkspaceDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await workspaces.getWorkspace(workspaceId, { bust: opts?.force });
				setWorkspace(result.workspace);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[workspaces, workspaceId],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { workspace, isLoading, error, refresh };
}
