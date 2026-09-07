import type { BillingClient, IPaymentMethodDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseSavePaymentMethodReturn {
	// Save the card after the Payment Element confirms the SetupIntent: makes it
	// the default and records it. Resolves to the saved card for display; rejects
	// (422) if the card isn't attached to this customer.
	save: (paymentMethodId: string) => Promise<IPaymentMethodDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useSavePaymentMethod(client?: BillingClient): IUseSavePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSavePaymentMethod');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function save(paymentMethodId: string): Promise<IPaymentMethodDTO | null> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.savePaymentMethod({ paymentMethodId });
			return result.paymentMethod;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { save, isLoading, error };
}
