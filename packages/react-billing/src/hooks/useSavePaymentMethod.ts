import type { BillingClient, IPaymentMethodDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseSavePaymentMethodReturn {
	// Save the card after the Payment Element confirms the SetupIntent: makes it
	// the default and records it. Resolves to the saved card for display; rejects
	// (422) if the card isn't attached to this customer.
	save: (paymentMethodId: string) => Promise<IPaymentMethodDTO | null>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useSavePaymentMethod(client?: BillingClient): IUseSavePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSavePaymentMethod');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const save = useCallback(
		async (paymentMethodId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.savePaymentMethod({ paymentMethodId });
				return result.paymentMethod;
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

	return { save, isLoading, error };
}
