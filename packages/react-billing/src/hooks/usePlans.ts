import type {
	BillingClient,
	FonderieApiError,
	ICreatePlanInput,
	IPlanDTO,
	IUpdatePlanInput,
} from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

import { toApiError, useBillingQuery } from './workspace';

export interface IUsePlansReturn {
	plans: IPlanDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createPlan: (input: ICreatePlanInput) => Promise<IPlanDTO>;
	updatePlan: (planId: string, input: IUpdatePlanInput) => Promise<IPlanDTO>;
	deletePlan: (planId: string) => Promise<void>;
}

const NO_PLANS: IPlanDTO[] = [];

export function usePlans(client?: BillingClient): IUsePlansReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlans');
	// The catalog is the same for every subscriber: not keyed by workspace.
	const q = useBillingQuery<IPlanDTO[]>(
		billing,
		'/plans',
		async (bust) => (await billing.listPlans({ bust })).result.plans,
		{ perWorkspace: false },
	);
	const [writeError, setWriteError] = useState<FonderieApiError | null>(null);
	const refresh = q.refresh;

	// These writes are not auth-gated by @fonderie/billing —
	// gate the UI that calls them behind your own admin check before shipping it.
	const write = useCallback(
		async <R,>(run: () => Promise<R>): Promise<R> => {
			setWriteError(null);
			try {
				const out = await run();
				await refresh();
				return out;
			} catch (err) {
				const apiError = toApiError(err);
				setWriteError(apiError);
				throw apiError;
			}
		},
		[refresh],
	);
	const createPlan = useCallback(
		(input: ICreatePlanInput) => write(async () => (await billing.createPlan(input)).result.plan),
		[billing, write],
	);
	const updatePlan = useCallback(
		(planId: string, input: IUpdatePlanInput) =>
			write(async () => (await billing.updatePlan(planId, input)).result.plan),
		[billing, write],
	);
	const deletePlan = useCallback(
		(planId: string) =>
			write(async () => {
				await billing.deletePlan(planId);
			}),
		[billing, write],
	);

	return {
		plans: q.data ?? NO_PLANS,
		isLoading: q.isLoading,
		error: writeError ?? q.error,
		refresh,
		createPlan,
		updatePlan,
		deletePlan,
	};
}
