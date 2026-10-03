import type { FonderieApiError, IWorkspaceDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/react';

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
	// Keyed by the id asked for, not the selected workspace.
	const q = useScopedQuery(
		workspaces,
		`/workspaces/${encodeURIComponent(workspaceId)}`,
		async (bust) => (await workspaces.getWorkspace(workspaceId, { bust })).result.workspace,
		{ perWorkspace: false },
	);
	return { workspace: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
