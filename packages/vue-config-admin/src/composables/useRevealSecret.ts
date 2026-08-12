import type { ConfigAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// Deliberately a manual action, never auto-fetched — a secret's plaintext
// value should only ever be requested on an explicit user click.
export function useRevealSecret(client: ConfigAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function revealSecret(key: string, environment?: string): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.revealSecret(key, environment);
			return result.value;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { revealSecret, isLoading, error };
}
