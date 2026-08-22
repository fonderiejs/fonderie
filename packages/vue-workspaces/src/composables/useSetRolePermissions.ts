import type { IRolePermissionInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useSetRolePermissions(client?: WorkspacesClient) {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useSetRolePermissions');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function setRolePermissions(roleId: string, permissions: IRolePermissionInput[]) {
		isLoading.value = true;
		error.value = null;
		try {
			await workspaces.setRolePermissions(roleId, permissions);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { setRolePermissions, isLoading, error };
}
