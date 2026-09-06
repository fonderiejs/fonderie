import type { BillingClient, ISubscriptionChangeResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseReactivateSubscriptionReturn {
	// Un-cancel a subscription scheduled to cancel at period end. Resolves to the
	// new lifecycle state; rejects (409) if the subscription is already fully
	// canceled — the caller should start a fresh checkout in that case.
	reactivate: () => Promise<ISubscriptionChangeResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useReactivateSubscription(client?: BillingClient): IUseReactivateSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useReactivateSubscription');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const reactivate = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await billing.reactivateSubscription();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [billing]);

	return { reactivate, isLoading, error };
}
