import type { ConfigAdminClient, IConfigEntry, ISetConfigInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useConfigEntries(client: ConfigAdminClient, environment?: string) {
	const entries = ref<IConfigEntry[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listConfig(environment);
			entries.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	async function saveEntry(key: string, input: ISetConfigInput) {
		error.value = null;
		try {
			const { result } = await client.setConfig(key, input, environment);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeEntry(key: string) {
		error.value = null;
		try {
			await client.deleteConfig(key, environment);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { entries, isLoading, error, refresh, saveEntry, removeEntry };
}
