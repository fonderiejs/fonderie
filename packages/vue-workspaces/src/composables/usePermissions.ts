import type { FonderieApiError, IMyPermissionsResult, PermissionOperation, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUsePermissionsReturn {
	/** May this member do `operation` on `resource` here? False until known. */
	can: (operation: PermissionOperation, resource: string) => boolean;
	isOwner: ComputedRef<boolean>;
	/** The owner or a manager: may run the team (members, invitations, roles, settings). */
	isManager: ComputedRef<boolean>;
	permissions: ComputedRef<IMyPermissionsResult['permissions']>;
	/** Nothing known yet — `can` answers false meanwhile. */
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

const NONE: IMyPermissionsResult['permissions'] = {};

// What the signed-in member may do in the SELECTED workspace — read once,
// shared, re-read on a workspace switch and after any workspace write (a role
// change). Until the answer is known, `can` says no: a button that appears
// late is better than one that appears and then dead-ends. `can` reads
// reactive state, so a template calling it re-renders when the answer lands.
export function usePermissions(client?: WorkspacesClient): IUsePermissionsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'usePermissions');
	const q = useScopedQuery(workspaces, '/workspaces/current/permissions', async (bust) => (await workspaces.getMyPermissions({ bust })).result);
	const can = (operation: PermissionOperation, resource: string) => {
		const data = q.data.value;
		return !!data && (data.isSuper || data.permissions[resource]?.[operation] === true);
	};
	return {
		can,
		isOwner: computed(() => q.data.value?.isOwner ?? false),
		isManager: computed(() => q.data.value?.isManager ?? false),
		permissions: computed(() => q.data.value?.permissions ?? NONE),
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}

/** `usePermissions().can(operation, resource)` as a computed, for a single check. */
export function useCan(
	operation: MaybeRefOrGetter<PermissionOperation>,
	resource: MaybeRefOrGetter<string>,
	client?: WorkspacesClient,
): ComputedRef<boolean> {
	const { can } = usePermissions(client);
	return computed(() => can(toValue(operation), toValue(resource)));
}
