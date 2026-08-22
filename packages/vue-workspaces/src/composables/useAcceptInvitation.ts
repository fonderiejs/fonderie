import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

/** @deprecated Use useWorkspaces().acceptInvitation — the list hook self-refreshes after the write. */
export function useAcceptInvitation(client?: WorkspacesClient) {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'useAcceptInvitation');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function acceptInvitation(pin: string): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await workspaces.acceptInvitation(pin);
			return result.workspaceId;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { acceptInvitation, isLoading, error };
}
