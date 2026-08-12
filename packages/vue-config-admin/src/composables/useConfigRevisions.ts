import type { ConfigAdminClient, IConfigRevision } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useConfigRevisions(client: ConfigAdminClient, key: string, environment?: string) {
	const revisions = ref<IConfigRevision[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		if (!key) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listConfigRevisions(key, environment);
			revisions.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function rollback(toVersion: number) {
		error.value = null;
		try {
			const { result } = await client.rollbackConfig(key, { toVersion }, environment);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { revisions, isLoading, error, refresh, rollback };
}
