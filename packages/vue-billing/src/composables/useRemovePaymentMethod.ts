import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseRemovePaymentMethodReturn {
	// Remove the saved card (detach at the provider + clear the record).
	remove: () => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useRemovePaymentMethod(client?: BillingClient): IUseRemovePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useRemovePaymentMethod');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function remove(): Promise<void> {
		isLoading.value = true;
		error.value = null;
		try {
			await billing.removePaymentMethod();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { remove, isLoading, error };
}
