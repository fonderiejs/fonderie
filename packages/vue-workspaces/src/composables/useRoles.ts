import type { ICreateRoleInput, IRoleDTO, IUpdateRoleInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseRolesReturn {
	roles: Ref<IRoleDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateRole: (roleId: string, input: IUpdateRoleInput) => Promise<IRoleDTO>;
	createRole: (input: ICreateRoleInput) => Promise<IRoleDTO>;
	removeRole: (roleId: string) => Promise<void>;
}

export function useRoles(client?: WorkspacesClient): IUseRolesReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useRoles');
	const roles = ref<IRoleDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.listRoles({ bust: opts?.force });
			roles.value = result.roles;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function createRole(input: ICreateRoleInput) {
		error.value = null;
		try {
			const { result } = await workspaces.createRole(input);
			await refresh();
			return result.role;
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
			await workspaces.removeRole(roleId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());

	async function updateRole(roleId: string, input: IUpdateRoleInput) {
		error.value = null;
		try {
			const { result } = await workspaces.updateRole(roleId, input);
			await refresh();
			return result.role;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { roles, isLoading, error, refresh, updateRole, createRole, removeRole };
}
