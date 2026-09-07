import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseRemovePaymentMethodReturn {
	// Remove the saved card (detach at the provider + clear the record).
	remove: () => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useRemovePaymentMethod(client?: BillingClient): IUseRemovePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useRemovePaymentMethod');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const remove = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			await billing.removePaymentMethod();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [billing]);

	return { remove, isLoading, error };
}
