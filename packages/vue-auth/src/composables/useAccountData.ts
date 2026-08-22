import type { AuthClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';
import { clearToken } from '../storage';

export interface IUseAccountDataReturn {
	// GET /users/export — the caller's own data as a portable bundle (SAR).
	exportData: () => Promise<unknown>;
	// Deletes the account, then tears the session down like a logout.
	deleteUser: () => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useAccountData(client?: AuthClient): IUseAccountDataReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useAccountData');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function run<T>(op: () => Promise<T>): Promise<T> {
		isLoading.value = true;
		error.value = null;
		try {
			return await op();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	function exportData() {
		return run(async () => {
			const { result } = await auth.exportData();
			return result;
		});
	}

	function deleteUser() {
		return run(async () => {
			await auth.deleteUser();
			auth.setAccessToken(undefined);
			clearToken();
		});
	}

	return { exportData, deleteUser, isLoading, error };
}
