import type { IPlanDTO } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUsePlanReturn {
	plan: IPlanDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

export function usePlan(planId: string): IUsePlanReturn;
export function usePlan(client: BillingClient | undefined, planId: string): IUsePlanReturn;
export function usePlan(
	clientOrPlanId: BillingClient | string | undefined,
	maybePlanId?: string,
): IUsePlanReturn {
	const firstIsClient = clientOrPlanId === undefined || clientOrPlanId instanceof BillingClient;
	const explicit = firstIsClient ? (clientOrPlanId as BillingClient | undefined) : undefined;
	const planId = firstIsClient ? (maybePlanId as string) : clientOrPlanId;
	const billing = useFonderieSubClient(explicit, (c) => c.billing, 'usePlan');
	const [plan, setPlan] = useState<IPlanDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getPlan(planId, { bust: opts?.force });
				setPlan(result.plan);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[billing, planId],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { plan, isLoading, error, refresh };
}
