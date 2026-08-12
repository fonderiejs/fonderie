import type { BillingClient, ISubscriptionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useSubscription(client: BillingClient) {
	const subscription = ref<ISubscriptionDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.getSubscription();
			subscription.value = result.subscription;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			// No active subscription is a normal, expected state — not an error banner.
			if (apiError.status !== 404) error.value = apiError;
			subscription.value = null;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { subscription, isLoading, error, refresh };
}
