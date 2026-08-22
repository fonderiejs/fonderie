import type { IRecordUsageInput } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseUsageReturn {
	total: number | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	recordUsage: (input: IRecordUsageInput) => Promise<void>;
}

export function useUsage(metric: string): IUseUsageReturn;
export function useUsage(client: BillingClient | undefined, metric: string): IUseUsageReturn;
export function useUsage(
	clientOrMetric: BillingClient | string | undefined,
	maybeMetric?: string,
): IUseUsageReturn {
	const firstIsClient = clientOrMetric === undefined || clientOrMetric instanceof BillingClient;
	const explicit = firstIsClient ? (clientOrMetric as BillingClient | undefined) : undefined;
	const metric = firstIsClient ? (maybeMetric as string) : clientOrMetric;
	const billing = useFonderieSubClient(explicit, (c) => c.billing, 'useUsage');
	const [total, setTotal] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getUsage(metric, { bust: opts?.force });
				setTotal(result.total);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[billing, metric],
	);

	const recordUsage = useCallback(
		async (input: IRecordUsageInput) => {
			setError(null);
			try {
				await billing.recordUsage(input);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[billing, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { total, isLoading, error, refresh, recordUsage };
}
