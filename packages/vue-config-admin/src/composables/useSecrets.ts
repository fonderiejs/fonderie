import type { ConfigAdminClient, ISecretEntry, ISetSecretInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useSecrets(client: ConfigAdminClient, environment?: string) {
	const secrets = ref<ISecretEntry[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listSecrets(environment);
			secrets.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	async function saveSecret(key: string, input: ISetSecretInput) {
		error.value = null;
		try {
			const { result } = await client.setSecret(key, input, environment);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeSecret(key: string) {
		error.value = null;
		try {
			await client.deleteSecret(key, environment);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { secrets, isLoading, error, refresh, saveSecret, removeSecret };
}
