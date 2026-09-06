import type { BillingClient, IWalletCheckoutInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseWalletCheckoutReturn {
	// Starts a one-time credit-pack purchase and resolves to the hosted checkout
	// URL to redirect the buyer to; the wallet is credited by the payment webhook.
	checkout: (input: IWalletCheckoutInput) => Promise<string>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useWalletCheckout(client?: BillingClient): IUseWalletCheckoutReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletCheckout');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const checkout = useCallback(
		async (input: IWalletCheckoutInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.createWalletCheckout(input);
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
