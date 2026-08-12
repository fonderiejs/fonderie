import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseBillingPortalReturn {
	openPortal: () => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useBillingPortal(client: BillingClient): IUseBillingPortalReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const openPortal = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.createPortalSession();
			return result.url;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	return { openPortal, isLoading, error };
}
