import type { AuthClient, IUserDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';
import { clearToken, readToken } from '../storage';

export function useSession(client?: AuthClient) {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useSession');
	const user = ref<IUserDTO | null>(null);
	const isLoading = ref(true);
	const isAuthenticated = ref(false);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		try {
			const { result } = await auth.getUser({ bust: opts?.force });
			user.value = result.user;
			isAuthenticated.value = true;
		} catch {
			user.value = null;
			isAuthenticated.value = false;
			auth.setAccessToken(undefined);
			clearToken();
		} finally {
			isLoading.value = false;
		}
	}

	async function logout(refreshToken?: string) {
		try {
			await auth.logout(refreshToken);
		} catch {
			// Session is being torn down regardless of server response.
		}
		auth.setAccessToken(undefined);
		clearToken();
		user.value = null;
		isAuthenticated.value = false;
	}

	const token = readToken();
	if (token) auth.setAccessToken(token);
	void refresh();

	return { user, isLoading, isAuthenticated, refresh, logout };
}
