import type { BillingClient, IRecordUsageInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useRecordUsage(client: BillingClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function recordUsage(input: IRecordUsageInput) {
		isLoading.value = true;
		error.value = null;
		try {
			await client.recordUsage(input);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { recordUsage, isLoading, error };
}
