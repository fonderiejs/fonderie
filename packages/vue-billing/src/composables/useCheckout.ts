import type { BillingClient, ICheckoutInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useCheckout(client?: BillingClient) {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useCheckout');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function checkout(input: ICheckoutInput): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.createCheckoutSession(input);
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

	return { checkout, isLoading, error };
}
