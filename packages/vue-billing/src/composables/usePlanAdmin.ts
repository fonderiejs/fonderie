import type { BillingClient, ICreatePlanInput, IUpdatePlanInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

// Action-only, like useUpdateRole/useWorkspaceProfile — pair with usePlans()
// for the list and call its refresh() after a write.
//
// Unlike every other write in this SDK, @fonderie/billing does not gate
// createPlan/updatePlan/deletePlan with requireAuth or an admin token — the
// server trusts the caller to authorize access itself. Gate the UI that
// calls this composable behind your own admin check before shipping it.
/** @deprecated Use usePlans() admin mutations — the list hook self-refreshes after the write. */
export function usePlanAdmin(client?: BillingClient) {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlanAdmin');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function createPlan(input: ICreatePlanInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.createPlan(input);
			return result.plan;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function updatePlan(planId: string, input: IUpdatePlanInput) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.updatePlan(planId, input);
			return result.plan;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function deletePlan(planId: string) {
		isLoading.value = true;
		error.value = null;
		try {
			await billing.deletePlan(planId);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { createPlan, updatePlan, deletePlan, isLoading, error };
}
