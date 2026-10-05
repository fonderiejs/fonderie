import type { FonderieApiError, IRolePermission, IRolePermissionInput } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseRolePermissionsReturn {
	permissions: Ref<IRolePermission[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Writes the full permission set for the role, then re-reads it.
	setRolePermissions: (permissions: IRolePermissionInput[]) => Promise<void>;
}

const NONE: IRolePermission[] = [];

export function useRolePermissions(roleId: MaybeRefOrGetter<string>): IUseRolePermissionsReturn;
export function useRolePermissions(
	client: WorkspacesClient | undefined,
	roleId: MaybeRefOrGetter<string>,
): IUseRolePermissionsReturn;
export function useRolePermissions(
	clientOrId: WorkspacesClient | MaybeRefOrGetter<string> | undefined,
	maybeId?: MaybeRefOrGetter<string>,
): IUseRolePermissionsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const roleId = firstIsClient ? (maybeId as MaybeRefOrGetter<string>) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useRolePermissions');
	// The key follows the id: a new id reads that entry.
	const q = useScopedQuery(
		workspaces,
		() => `/workspaces/roles/${encodeURIComponent(toValue(roleId))}/permissions`,
		async (bust) => (await workspaces.getRolePermissions(toValue(roleId), { bust })).result.permissions,
		// No id yet (a screen still resolving it): wait, don't request '/…/'.
		{ enabled: () => !!toValue(roleId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		permissions: computed(() => q.data.value ?? NONE),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		setRolePermissions: (input) =>
			w.run(async () => {
				await workspaces.setRolePermissions(toValue(roleId), input);
			}),
	};
}
