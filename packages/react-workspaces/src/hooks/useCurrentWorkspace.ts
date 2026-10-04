import type { FonderieApiError, IWorkspaceDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/react';

export interface IUseCurrentWorkspaceReturn {
	workspace: IWorkspaceDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The SELECTED workspace (or the personal one when none is selected), from the
// shared cache: every screen reading it sees the same object, and a workspace
// switch re-reads it — so an app needs no store copy of its own. Changes go
// through useWorkspaceProfile; call refresh() after one.
export function useCurrentWorkspace(client?: WorkspacesClient): IUseCurrentWorkspaceReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useCurrentWorkspace');
	const q = useScopedQuery(
		workspaces,
		'/workspaces/current',
		async (bust) => (await workspaces.getCurrentWorkspace({ bust })).result.workspace,
	);
	return { workspace: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
