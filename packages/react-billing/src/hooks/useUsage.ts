import type { IRecordUsageInput, IUsageResult } from '@fonderie/client';
import { BillingClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

import { toApiError, useBillingQuery } from './workspace';

export interface IUseUsageReturn {
	// Used in the current window for a windowed plan limit (e.g. 'api-calls'),
	// else recorded this month. null until the first read resolves.
	total: number | null;
	// The whole reading: limit, status ('ok' | 'warning' | 'over_limit' |
	// 'blocked'), window and resetsAt for a windowed plan limit.
	usage: IUsageResult | null;
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
	const q = useBillingQuery<IUsageResult>(
		billing,
		`/billing/usage/${encodeURIComponent(metric)}`,
		async (bust) => (await billing.getUsage(metric, { bust })).result,
	);
	const [writeError, setWriteError] = useState<FonderieApiError | null>(null);

	const recordUsage = useCallback(
		async (input: IRecordUsageInput) => {
			setWriteError(null);
			try {
				await billing.recordUsage(input);
				await q.refresh();
			} catch (err) {
				const apiError = toApiError(err);
				setWriteError(apiError);
				throw apiError;
			}
		},
		[billing, q.refresh],
	);

	return {
		total: q.data?.total ?? null,
		usage: q.data ?? null,
		isLoading: q.isLoading,
		error: writeError ?? q.error,
		refresh: q.refresh,
		recordUsage,
	};
}
