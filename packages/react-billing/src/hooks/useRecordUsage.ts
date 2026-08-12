import type { BillingClient, IRecordUsageInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseRecordUsageReturn {
	recordUsage: (input: IRecordUsageInput) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useRecordUsage(client: BillingClient): IUseRecordUsageReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const recordUsage = useCallback(
		async (input: IRecordUsageInput) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.recordUsage(input);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[client],
	);

	return { recordUsage, isLoading, error };
}
