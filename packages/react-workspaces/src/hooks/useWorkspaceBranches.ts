import type {
	FonderieApiError,
	ICreateWorkspaceBranchInput,
	IUpdateWorkspaceBranchInput,
	IWorkspaceBranchDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback, useMemo } from 'react';

export interface IUseWorkspaceBranchesReturn {
	/** The default first; archived ones last (`isArchived`), restorable. */
	branches: IWorkspaceBranchDTO[];
	/** The default branch — what the workspace's own profile mirrors. */
	defaultBranch: IWorkspaceBranchDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createBranch: (input: ICreateWorkspaceBranchInput) => Promise<IWorkspaceBranchDTO>;
	updateBranch: (branchId: string, input: IUpdateWorkspaceBranchInput) => Promise<IWorkspaceBranchDTO>;
	/** The workspace's profile and primary contacts follow the new default. */
	setDefaultBranch: (branchId: string) => Promise<IWorkspaceBranchDTO>;
	/** The default cannot be archived: 409 DEFAULT_ARCHIVE — make another the default first. */
	archiveBranch: (branchId: string) => Promise<IWorkspaceBranchDTO>;
	restoreBranch: (branchId: string) => Promise<IWorkspaceBranchDTO>;
}

const NONE: IWorkspaceBranchDTO[] = [];

/** The key the branch hooks share with the contact hooks' invalidation: a branch change re-reads both. */
export const WORKSPACE_BRANCHES_KEY = '/workspaces/branches';

// The selected workspace's branches — one customer-facing identity each —
// re-read on a workspace switch and after every change. Writes are for
// owners / managers.
export function useWorkspaceBranches(client?: WorkspacesClient): IUseWorkspaceBranchesReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceBranches');
	const q = useScopedQuery(api, WORKSPACE_BRANCHES_KEY, async (bust) => (await api.listBranches({ bust })).result.branches);
	const w = useWrite(q.refresh);
	const createBranch = useCallback(
		(input: ICreateWorkspaceBranchInput) => w.run(async () => (await api.createBranch(input)).result.branch),
		[api, w.run],
	);
	const updateBranch = useCallback(
		(branchId: string, input: IUpdateWorkspaceBranchInput) => w.run(async () => (await api.updateBranch(branchId, input)).result.branch),
		[api, w.run],
	);
	const setDefaultBranch = useCallback((branchId: string) => w.run(async () => (await api.setDefaultBranch(branchId)).result.branch), [api, w.run]);
	const archiveBranch = useCallback((branchId: string) => w.run(async () => (await api.archiveBranch(branchId)).result.branch), [api, w.run]);
	const restoreBranch = useCallback((branchId: string) => w.run(async () => (await api.restoreBranch(branchId)).result.branch), [api, w.run]);
	const branches = q.data ?? NONE;
	const defaultBranch = useMemo(() => branches.find((b) => b.isDefault) ?? null, [branches]);
	return {
		branches,
		defaultBranch,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		createBranch,
		updateBranch,
		setDefaultBranch,
		archiveBranch,
		restoreBranch,
	};
}
