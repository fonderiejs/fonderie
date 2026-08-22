import type { ConfigAdminClient, ISetSecretInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

/** @deprecated Use useSecrets(client).saveSecret — the list composable self-refreshes after the write. */
export function useSaveSecret(client: ConfigAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function saveSecret(key: string, input: ISetSecretInput, environment?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.setSecret(key, input, environment);
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { saveSecret, isLoading, error };
}
