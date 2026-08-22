import type { IMemberDTO, WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useMembers(client?: WorkspacesClient) {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useMembers');
	const members = ref<IMemberDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.listMembers();
			members.value = result.members;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { members, isLoading, error, refresh };
}
