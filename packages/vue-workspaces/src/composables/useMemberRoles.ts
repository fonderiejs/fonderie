import type { IRoleDTO } from '@fonderie/client';
import { FonderieApiError, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseMemberRolesReturn {
	roles: Ref<IRoleDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addRole: (roleId: string) => Promise<void>;
	removeRole: (roleId: string) => Promise<void>;
}

export function useMemberRoles(userId: string): IUseMemberRolesReturn;
export function useMemberRoles(
	client: WorkspacesClient | undefined,
	userId: string,
): IUseMemberRolesReturn;
export function useMemberRoles(
	clientOrId: WorkspacesClient | string | undefined,
	maybeId?: string,
): IUseMemberRolesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof WorkspacesClient;
	const explicit = firstIsClient ? (clientOrId as WorkspacesClient | undefined) : undefined;
	const userId = firstIsClient ? (maybeId as string) : clientOrId;
	const workspaces = useFonderieSubClient(explicit, (c) => c.workspaces, 'useMemberRoles');
	const roles = ref<IRoleDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.getMemberRoles(userId, { bust: opts?.force });
			roles.value = result.roles;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function addRole(roleId: string) {
		error.value = null;
		try {
			await workspaces.addMemberRole(userId, roleId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeRole(roleId: string) {
		error.value = null;
		try {
			await workspaces.removeMemberRole(userId, roleId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { roles, isLoading, error, refresh, addRole, removeRole };
}
