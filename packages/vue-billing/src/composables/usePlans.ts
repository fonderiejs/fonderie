import type { BillingClient, ICreatePlanInput, IPlanDTO, IUpdatePlanInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function usePlans(client?: BillingClient) {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlans');
	const plans = ref<IPlanDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.listPlans({ bust: opts?.force });
			plans.value = result.plans;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	async function createPlan(input: ICreatePlanInput) {
		error.value = null;
		try {
			const { result } = await billing.createPlan(input);
			await refresh();
			return result.plan;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function updatePlan(planId: string, input: IUpdatePlanInput) {
		error.value = null;
		try {
			const { result } = await billing.updatePlan(planId, input);
			await refresh();
			return result.plan;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function deletePlan(planId: string) {
		error.value = null;
		try {
			await billing.deletePlan(planId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { plans, isLoading, error, refresh, createPlan, updatePlan, deletePlan };
}
