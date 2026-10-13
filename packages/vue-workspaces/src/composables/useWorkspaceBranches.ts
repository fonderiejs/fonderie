import type {
	FonderieApiError,
	ICreateWorkspaceBranchInput,
	IUpdateWorkspaceBranchInput,
	IWorkspaceBranchDTO,
	WorkspacesClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseWorkspaceBranchesReturn {
	/** The default first; archived ones last (`isArchived`), restorable. */
	branches: Ref<IWorkspaceBranchDTO[]>;
	/** The default branch — what the workspace's own profile mirrors. */
	defaultBranch: Ref<IWorkspaceBranchDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
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

/** The key the branch composables share with the contact composables' invalidation. */
export const WORKSPACE_BRANCHES_KEY = '/workspaces/branches';

// The selected workspace's branches — one customer-facing identity each —
// re-read on a workspace switch and after every change. Writes are for
// owners / managers.
export function useWorkspaceBranches(client?: WorkspacesClient): IUseWorkspaceBranchesReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useWorkspaceBranches');
	const q = useScopedQuery(api, WORKSPACE_BRANCHES_KEY, async (bust) => (await api.listBranches({ bust })).result.branches);
	const w = useWrite(() => q.refresh());
	const branches = computed(() => q.data.value ?? NONE);
	return {
		branches,
		defaultBranch: computed(() => branches.value.find((b) => b.isDefault) ?? null),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		createBranch: (input) => w.run(async () => (await api.createBranch(input)).result.branch),
		updateBranch: (branchId, input) => w.run(async () => (await api.updateBranch(branchId, input)).result.branch),
		setDefaultBranch: (branchId) => w.run(async () => (await api.setDefaultBranch(branchId)).result.branch),
		archiveBranch: (branchId) => w.run(async () => (await api.archiveBranch(branchId)).result.branch),
		restoreBranch: (branchId) => w.run(async () => (await api.restoreBranch(branchId)).result.branch),
	};
}
