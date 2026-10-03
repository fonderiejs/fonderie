import type { BillingClient, FonderieApiError, ISubscriptionDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';

import { useBillingQuery } from './workspace';

export interface IUseSubscriptionReturn {
	subscription: ISubscriptionDTO | null;
	/** Nothing to show yet — never true while a refresh runs behind data. */
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

export function useSubscription(client?: BillingClient): IUseSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSubscription');
	const q = useBillingQuery<ISubscriptionDTO | null>(
		billing,
		'/billing/subscription',
		async (bust) => (await billing.getSubscription({ bust })).result.subscription,
		// No active subscription is a normal, expected state — not an error banner.
		{ normal: (err) => (err.status === 404 ? null : undefined) },
	);
	return { subscription: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
