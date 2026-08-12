import type { BillingClient, ISubscriptionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseSubscriptionReturn {
	subscription: ISubscriptionDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useSubscription(client: BillingClient): IUseSubscriptionReturn {
	const [subscription, setSubscription] = useState<ISubscriptionDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getSubscription();
			setSubscription(result.subscription);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			// No active subscription is a normal, expected state — not an error banner.
			if (apiError.status !== 404) setError(apiError);
			setSubscription(null);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { subscription, isLoading, error, refresh };
}
