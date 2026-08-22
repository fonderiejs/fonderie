import type { BillingClient, IRecordUsageInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

/** @deprecated Use `useUsage(metric).recordUsage` instead — the usage hook self-refreshes after the write. */
export interface IUseRecordUsageReturn {
	recordUsage: (input: IRecordUsageInput) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use `useUsage(metric).recordUsage` instead — the usage hook self-refreshes after the write. */
export function useRecordUsage(client?: BillingClient): IUseRecordUsageReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useRecordUsage');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const recordUsage = useCallback(
		async (input: IRecordUsageInput) => {
			setIsLoading(true);
			setError(null);
			try {
				await billing.recordUsage(input);
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

	return { recordUsage, isLoading, error };
}
