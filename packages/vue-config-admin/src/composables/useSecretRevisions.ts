import type { ConfigAdminClient, ISecretRevision } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useSecretRevisions(client: ConfigAdminClient, key: string, environment?: string) {
	const revisions = ref<ISecretRevision[]>([]);
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
			const { result } = await client.listSecretRevisions(key, environment);
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
			const { result } = await client.rollbackSecret(key, { toVersion }, environment);
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
