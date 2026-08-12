import type { IRoleDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useMemberRoles(client: WorkspacesClient, userId: string) {
	const roles = ref<IRoleDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.getMemberRoles(userId);
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
			await client.addMemberRole(userId, roleId);
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
			await client.removeMemberRole(userId, roleId);
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
