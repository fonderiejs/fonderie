import type { IUpdateRoleInput, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useUpdateRole(client?: WorkspacesClient) {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useUpdateRole');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function updateRole(roleId: string, input: IUpdateRoleInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.updateRole(roleId, input);
			return result.role;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { updateRole, isLoading, error };
}
