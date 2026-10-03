import type { FonderieApiError, IRoleDTO } from '@fonderie/client';
import { WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseMemberRolesReturn {
	roles: Ref<IRoleDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addRole: (roleId: string) => Promise<void>;
	removeRole: (roleId: string) => Promise<void>;
}

const NONE: IRoleDTO[] = [];

export function useMemberRoles(userId: MaybeRefOrGetter<string>): IUseMemberRolesReturn;
export function useMemberRoles(
	client: WorkspacesClient | undefined,
	userId: MaybeRefOrGetter<string>,
): IUseMemberRolesReturn;
export function useMemberRoles(
	clientOrId: WorkspacesClient | MaybeRefOrGetter<string> | undefined,
	maybeId?: MaybeRefOrGetter<string>,
): IUseMemberRolesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const userId = firstIsClient ? (maybeId as MaybeRefOrGetter<string>) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useMemberRoles');
	// The key follows the id: a new id reads that entry.
	const q = useScopedQuery(
		workspaces,
		() => `/workspaces/members/${encodeURIComponent(toValue(userId))}/roles`,
		async (bust) => (await workspaces.getMemberRoles(toValue(userId), { bust })).result.roles,
	);
	const w = useWrite(() => q.refresh());
	return {
		roles: computed(() => q.data.value ?? NONE),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		addRole: (roleId) =>
			w.run(async () => {
				await workspaces.addMemberRole(toValue(userId), roleId);
			}),
		removeRole: (roleId) =>
			w.run(async () => {
				await workspaces.removeMemberRole(toValue(userId), roleId);
			}),
	};
}
