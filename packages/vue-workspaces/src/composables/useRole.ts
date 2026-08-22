import type { IRoleDTO } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseRoleReturn {
	role: Ref<IRoleDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// Read composable for a single role. Writes live where their lists refresh:
// useRoles (create/update/remove) and useRolePermissions (permission set).
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
	const role = ref<IRoleDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.getRole(toValue(id), { bust: opts?.force });
			role.value = result.role;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(id),
		() => void refresh(),
	);

	return { role, isLoading, error, refresh };
}
