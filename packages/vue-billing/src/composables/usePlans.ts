import type { BillingClient, IPlanDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function usePlans(client?: BillingClient) {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlans');
	const plans = ref<IPlanDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.listPlans();
			plans.value = result.plans;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { plans, isLoading, error, refresh };
}
