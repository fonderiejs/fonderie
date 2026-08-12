import type { WorkspacesClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useAcceptInvitation(client: WorkspacesClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function acceptInvitation(pin: string): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.acceptInvitation(pin);
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
