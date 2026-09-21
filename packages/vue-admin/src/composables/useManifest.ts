import type { AdminClient, IAdminManifest } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useManifest(client: AdminClient) {
	const manifest = ref<IAdminManifest | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.manifest();
			manifest.value = result;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { manifest, isLoading, error, refresh };
}
