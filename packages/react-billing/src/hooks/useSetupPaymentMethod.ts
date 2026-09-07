import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseSetupPaymentMethodReturn {
	// Begin in-app card entry — resolves to the provider SetupIntent client secret
	// the embedded card element (Stripe Payment Element) confirms. No redirect;
	// the user never leaves the site. 501 when the provider has no in-app support.
	setup: () => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useSetupPaymentMethod(client?: BillingClient): IUseSetupPaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSetupPaymentMethod');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const setup = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await billing.setupPaymentMethod();
			return result.clientSecret;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [billing]);

	return { setup, isLoading, error };
}
