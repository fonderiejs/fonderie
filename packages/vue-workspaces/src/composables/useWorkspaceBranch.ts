import type { FonderieApiError, IWorkspaceBranchDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseWorkspaceBranchReturn {
	branch: Ref<IWorkspaceBranchDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read composable for one branch. Writes live where their list refreshes
// (useWorkspaceBranches) — and any of them marks this read stale too.
export function useWorkspaceBranch(id: MaybeRefOrGetter<string>): IUseWorkspaceBranchReturn;
export function useWorkspaceBranch(client: WorkspacesClient | undefined, id: MaybeRefOrGetter<string>): IUseWorkspaceBranchReturn;
export function useWorkspaceBranch(
	clientOrId: WorkspacesClient | MaybeRefOrGetter<string> | undefined,
	maybeId?: MaybeRefOrGetter<string>,
): IUseWorkspaceBranchReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const id = firstIsClient ? (maybeId as MaybeRefOrGetter<string>) : clientOrId;
	const api = useFonderieSubClient(explicit, (c) => c.workspaces, 'useWorkspaceBranch');
	// The key follows the id: a new id reads that entry.
	const q = useScopedQuery(
		api,
		() => `/workspaces/branches/${encodeURIComponent(toValue(id))}`,
		async (bust) => (await api.getBranch(toValue(id), { bust })).result.branch,
		// No id yet (a screen still resolving it): wait, don't request '/…/'.
		{ enabled: () => !!toValue(id) },
	);
	return {
		branch: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}
