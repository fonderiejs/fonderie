import type { BillingClient, IPaymentMethodDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUsePaymentMethodReturn {
	paymentMethod: Ref<IPaymentMethodDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's card on file (GET /billing/payment-method). A provider 501
// (can't retrieve one) reads as "no card", not an error.
export function usePaymentMethod(client?: BillingClient): IUsePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePaymentMethod');
	const paymentMethod = ref<IPaymentMethodDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getPaymentMethod({ bust: opts?.force });
			paymentMethod.value = result.paymentMethod;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			if (apiError.status !== 501) error.value = apiError;
			paymentMethod.value = null;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	return { paymentMethod, isLoading, error, refresh };
}
