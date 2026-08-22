import type { ConfigAdminClient, ISetConfigInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

/** @deprecated Use useConfigEntries(client).saveEntry — the list composable self-refreshes after the write. */
export function useSaveConfigEntry(client: ConfigAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function saveConfigEntry(key: string, input: ISetConfigInput, environment?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.setConfig(key, input, environment);
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

	return { saveConfigEntry, isLoading, error };
}
