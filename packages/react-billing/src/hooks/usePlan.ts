import type { IPlanDTO } from '@fonderie/client';
import { BillingClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';

import { useBillingQuery } from './workspace';

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
	// The catalog is the same for every subscriber: not keyed by workspace.
	const q = useBillingQuery<IPlanDTO>(
		billing,
		`/plans/${encodeURIComponent(planId)}`,
		async (bust) => (await billing.getPlan(planId, { bust })).result.plan,
		{ perWorkspace: false },
	);
	return { plan: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
