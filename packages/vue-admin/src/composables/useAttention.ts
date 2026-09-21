import type { AdminClient, IAdminAttention } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useAttention(client: AdminClient) {
	const attention = ref<IAdminAttention | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.attention();
			attention.value = result;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { attention, isLoading, error, refresh };
}
