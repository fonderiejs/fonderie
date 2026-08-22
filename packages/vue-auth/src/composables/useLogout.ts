import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { clearToken } from '../storage';

export interface IUseLogoutReturn {
	logout: (refreshToken?: string) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useLogout(client?: AuthClient): IUseLogoutReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useLogout');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function logout(refreshToken?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await auth.logout(refreshToken);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			auth.setAccessToken(undefined);
			clearToken();
			isLoading.value = false;
		}
	}

	return { logout, isLoading, error };
}
