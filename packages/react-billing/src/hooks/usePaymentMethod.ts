import type { BillingClient, FonderieApiError, IPaymentMethodDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';

import { useBillingQuery } from './workspace';

export interface IUsePaymentMethodReturn {
	// The card on file (brand/last4/expiry), or null when none is stored or the
	// provider can't retrieve one (a normal "no card" state, not an error).
	paymentMethod: IPaymentMethodDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's card on file, for a billing page. Reads GET
// /billing/payment-method.
export function usePaymentMethod(client?: BillingClient): IUsePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePaymentMethod');
	const q = useBillingQuery<IPaymentMethodDTO | null>(
		billing,
		'/billing/payment-method',
		async (bust) => (await billing.getPaymentMethod({ bust })).result.paymentMethod,
		// 501 = the provider can't retrieve a card — "no card on file", not an error.
		{ normal: (err) => (err.status === 501 ? null : undefined) },
	);
	return { paymentMethod: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
