import type { FonderieApiError, IWorkspaceDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseWorkspaceReturn {
	workspace: Ref<IWorkspaceDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read composable for an explicit workspace id (admin/cross-workspace
// lookups) — keyed by that id, not the selected workspace. Mutations on the
// CURRENT workspace live in useWorkspaceProfile.
export function useWorkspace(id: MaybeRefOrGetter<string>): IUseWorkspaceReturn;
export function useWorkspace(
	client: WorkspacesClient | undefined,
	id: MaybeRefOrGetter<string>,
): IUseWorkspaceReturn;
export function useWorkspace(
	clientOrId: WorkspacesClient | MaybeRefOrGetter<string> | undefined,
	maybeId?: MaybeRefOrGetter<string>,
): IUseWorkspaceReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const id = firstIsClient ? (maybeId as MaybeRefOrGetter<string>) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useWorkspace');
	// The key follows the id: a new id reads that entry.
	const q = useScopedQuery(
		workspaces,
		() => `/workspaces/${encodeURIComponent(toValue(id))}`,
		async (bust) => (await workspaces.getWorkspace(toValue(id), { bust })).result.workspace,
		{ perWorkspace: false },
	);
	return {
		workspace: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}
