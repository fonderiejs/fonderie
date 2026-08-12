import type { BillingClient, ICreatePlanInput, IPlanDTO, IUpdatePlanInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUsePlanAdminReturn {
	createPlan: (input: ICreatePlanInput) => Promise<IPlanDTO>;
	updatePlan: (planId: string, input: IUpdatePlanInput) => Promise<IPlanDTO>;
	deletePlan: (planId: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

// Action-only, like useUpdateRole/useWorkspaceProfile — pair with usePlans()
// for the list and call its refresh() after a write.
//
// Unlike every other write in this SDK, @fonderie/billing does not gate
// createPlan/updatePlan/deletePlan with requireAuth or an admin token — the
// server trusts the caller to authorize access itself. Gate the UI that
// calls this hook behind your own admin check before shipping it.
export function usePlanAdmin(client: BillingClient): IUsePlanAdminReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const createPlan = useCallback(
		async (input: ICreatePlanInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.createPlan(input);
				return result.plan;
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

	const updatePlan = useCallback(
		async (planId: string, input: IUpdatePlanInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.updatePlan(planId, input);
				return result.plan;
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

	const deletePlan = useCallback(
		async (planId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.deletePlan(planId);
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

	return { createPlan, updatePlan, deletePlan, isLoading, error };
}
