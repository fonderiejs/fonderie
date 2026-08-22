import type { BillingClient, ICheckoutInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseCheckoutReturn {
	checkout: (input: ICheckoutInput) => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useCheckout(client?: BillingClient): IUseCheckoutReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useCheckout');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const checkout = useCallback(
		async (input: ICheckoutInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.createCheckoutSession(input);
				return result.url;
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

	return { checkout, isLoading, error };
}
