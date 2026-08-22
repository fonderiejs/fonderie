import type { IRolePermission, IRolePermissionInput } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseRolePermissionsReturn {
	permissions: Ref<IRolePermission[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Writes the full permission set for the role, then re-reads it — the
	// read/write pair lives in one composable so editors can pre-populate.
	setRolePermissions: (permissions: IRolePermissionInput[]) => Promise<void>;
}

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
	const permissions = ref<IRolePermission[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.getRolePermissions(toValue(roleId), {
				bust: opts?.force,
			});
			permissions.value = result.permissions;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function setRolePermissions(input: IRolePermissionInput[]) {
		error.value = null;
		try {
			await workspaces.setRolePermissions(toValue(roleId), input);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(roleId),
		() => void refresh(),
	);

	return { permissions, isLoading, error, refresh, setRolePermissions };
}
