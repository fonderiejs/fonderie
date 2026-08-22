import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseBillingPortalReturn {
	openPortal: () => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useBillingPortal(client?: BillingClient): IUseBillingPortalReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useBillingPortal');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const openPortal = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await billing.createPortalSession();
			return result.url;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [billing]);

	return { openPortal, isLoading, error };
}
