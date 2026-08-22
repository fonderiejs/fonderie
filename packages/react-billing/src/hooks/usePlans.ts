import type {
	BillingClient,
	ICreatePlanInput,
	IPlanDTO,
	IUpdatePlanInput,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUsePlansReturn {
	plans: IPlanDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createPlan: (input: ICreatePlanInput) => Promise<IPlanDTO>;
	updatePlan: (planId: string, input: IUpdatePlanInput) => Promise<IPlanDTO>;
	deletePlan: (planId: string) => Promise<void>;
}

export function usePlans(client?: BillingClient): IUsePlansReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlans');
	const [plans, setPlans] = useState<IPlanDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.listPlans({ bust: opts?.force });
				setPlans(result.plans);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[billing],
	);

	// These writes are not auth-gated by @fonderie/billing —
	// gate the UI that calls them behind your own admin check before shipping it.
	const createPlan = useCallback(
		async (input: ICreatePlanInput) => {
			setError(null);
			try {
				const { result } = await billing.createPlan(input);
				await refresh();
				return result.plan;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[billing, refresh],
	);

	const updatePlan = useCallback(
		async (planId: string, input: IUpdatePlanInput) => {
			setError(null);
			try {
				const { result } = await billing.updatePlan(planId, input);
				await refresh();
				return result.plan;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[billing, refresh],
	);

	const deletePlan = useCallback(
		async (planId: string) => {
			setError(null);
			try {
				await billing.deletePlan(planId);
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

	return { plans, isLoading, error, refresh, createPlan, updatePlan, deletePlan };
}
