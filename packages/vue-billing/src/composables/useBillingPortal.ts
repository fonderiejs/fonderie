import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useBillingPortal(client: BillingClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function openPortal(): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.createPortalSession();
			return result.url;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { openPortal, isLoading, error };
}
