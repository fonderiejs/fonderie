import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseUsageReturn {
	total: number | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
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

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await billing.getUsage(metric);
			setTotal(result.total);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [billing, metric]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { total, isLoading, error, refresh };
}
