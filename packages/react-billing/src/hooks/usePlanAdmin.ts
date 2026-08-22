import type { BillingClient, ICreatePlanInput, IPlanDTO, IUpdatePlanInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

/** @deprecated Use `usePlans().createPlan` / `updatePlan` / `deletePlan` instead — the list hook self-refreshes after each write. */
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
/** @deprecated Use `usePlans().createPlan` / `updatePlan` / `deletePlan` instead — the list hook self-refreshes after each write. */
export function usePlanAdmin(client?: BillingClient): IUsePlanAdminReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlanAdmin');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const createPlan = useCallback(
		async (input: ICreatePlanInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.createPlan(input);
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
		[billing],
	);

	const updatePlan = useCallback(
		async (planId: string, input: IUpdatePlanInput) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.updatePlan(planId, input);
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
		[billing],
	);

	const deletePlan = useCallback(
		async (planId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await billing.deletePlan(planId);
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

	return { createPlan, updatePlan, deletePlan, isLoading, error };
}
