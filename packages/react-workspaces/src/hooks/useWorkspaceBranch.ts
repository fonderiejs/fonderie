import type { FonderieApiError, IWorkspaceBranchDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/react';

export interface IUseWorkspaceBranchReturn {
	branch: IWorkspaceBranchDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read hook for one branch. Writes live where their list refreshes
// (useWorkspaceBranches), and any of them marks this read stale too (same
// /workspaces resource).
export function useWorkspaceBranch(branchId: string): IUseWorkspaceBranchReturn;
export function useWorkspaceBranch(client: WorkspacesClient | undefined, branchId: string): IUseWorkspaceBranchReturn;
export function useWorkspaceBranch(clientOrId: WorkspacesClient | string | undefined, maybeId?: string): IUseWorkspaceBranchReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const branchId = firstIsClient ? (maybeId as string) : clientOrId;
	const api = useFonderieSubClient(explicit, (c) => c.workspaces, 'useWorkspaceBranch');
	const q = useScopedQuery(
		api,
		`/workspaces/branches/${encodeURIComponent(branchId)}`,
		async (bust) => (await api.getBranch(branchId, { bust })).result.branch,
		// No id yet (a screen still resolving it): wait, don't request '/…/'.
		{ enabled: !!branchId },
	);
	return { branch: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
