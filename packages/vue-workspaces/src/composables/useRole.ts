import type { FonderieApiError, IRoleDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseRoleReturn {
	role: Ref<IRoleDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read composable for a single role. Writes live where their lists refresh
// (useRoles, useRolePermissions) — and any of them marks this read stale too.
export function useRole(id: MaybeRefOrGetter<string>): IUseRoleReturn;
export function useRole(
	client: WorkspacesClient | undefined,
	id: MaybeRefOrGetter<string>,
): IUseRoleReturn;
export function useRole(
	clientOrId: WorkspacesClient | MaybeRefOrGetter<string> | undefined,
	maybeId?: MaybeRefOrGetter<string>,
): IUseRoleReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const id = firstIsClient ? (maybeId as MaybeRefOrGetter<string>) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useRole');
	// The key follows the id: a new id reads that entry.
	const q = useScopedQuery(
		workspaces,
		() => `/workspaces/roles/${encodeURIComponent(toValue(id))}`,
		async (bust) => (await workspaces.getRole(toValue(id), { bust })).result.role,
	);
	return {
		role: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}
