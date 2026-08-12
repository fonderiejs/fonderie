import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';
import { clearToken } from '../storage';

export function useLogout(client: AuthClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function logout() {
		isLoading.value = true;
		error.value = null;
		try {
			await client.logout();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			client.setAccessToken(undefined);
			clearToken();
			isLoading.value = false;
		}
	}

	return { logout, isLoading, error };
}
