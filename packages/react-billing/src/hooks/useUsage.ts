import type { IRecordUsageInput, IUsageResult } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

import { useLatestRequest, useWorkspaceSwitch } from './workspace';

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
	const [usage, setUsage] = useState<IUsageResult | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = useWorkspaceSwitch(billing, () => {
		setUsage(null);
		setError(null);
		setIsLoading(true);
	});
	const beginRequest = useLatestRequest();

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			const isLatest = beginRequest();
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getUsage(metric, { bust: opts?.force });
				if (!isLatest()) return;
				setUsage(result);
			} catch (err) {
				if (!isLatest()) return;
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				if (isLatest()) setIsLoading(false);
			}
		},
		[billing, metric, beginRequest],
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: workspaceId re-runs the read on a workspace switch
	useEffect(() => {
		void refresh();
	}, [refresh, workspaceId]);

	return { total: usage?.total ?? null, usage, isLoading, error, refresh, recordUsage };
}
