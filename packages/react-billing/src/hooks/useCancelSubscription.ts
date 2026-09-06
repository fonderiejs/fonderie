import type {
	BillingClient,
	ICancelSubscriptionInput,
	ISubscriptionChangeResult,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseCancelSubscriptionReturn {
	// First-party cancel — no billing-portal round-trip. Default keeps access
	// until the paid-through date; pass { atPeriodEnd: false } to end it now.
	// Resolves to the new lifecycle state ({ atPeriodEnd, status, currentPeriodEnd }).
	cancel: (input?: ICancelSubscriptionInput) => Promise<ISubscriptionChangeResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useCancelSubscription(client?: BillingClient): IUseCancelSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useCancelSubscription');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const cancel = useCallback(
		async (input?: ICancelSubscriptionInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.cancelSubscription(input);
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[billing],
	);

	return { cancel, isLoading, error };
}
