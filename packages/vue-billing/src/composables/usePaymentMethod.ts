import type { BillingClient, FonderieApiError, IPaymentMethodDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

import { useBillingQuery } from './workspace';

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
	const q = useBillingQuery<IPaymentMethodDTO | null>(
		billing,
		'/billing/payment-method',
		async (bust) => (await billing.getPaymentMethod({ bust })).result.paymentMethod,
		{ normal: (err) => (err.status === 501 ? null : undefined) },
	);
	return { paymentMethod: computed(() => q.data.value ?? null), isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
