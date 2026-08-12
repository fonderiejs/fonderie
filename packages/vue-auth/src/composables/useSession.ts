import type { AuthClient, IUserDTO } from '@fonderie/client';
import { ref } from 'vue';
import { clearToken, readToken } from '../storage';

export function useSession(client: AuthClient) {
	const user = ref<IUserDTO | null>(null);
	const isLoading = ref(true);
	const isAuthenticated = ref(false);

	async function refresh() {
		isLoading.value = true;
		try {
			const { result } = await client.getUser();
			user.value = result.user;
			isAuthenticated.value = true;
		} catch {
			user.value = null;
			isAuthenticated.value = false;
			client.setAccessToken(undefined);
			clearToken();
		} finally {
			isLoading.value = false;
		}
	}

	async function logout() {
		try {
			await client.logout();
		} catch {
			// Session is being torn down regardless of server response.
		}
		client.setAccessToken(undefined);
		clearToken();
		user.value = null;
		isAuthenticated.value = false;
	}

	const token = readToken();
	if (token) client.setAccessToken(token);
	void refresh();

	return { user, isLoading, isAuthenticated, refresh, logout };
}
