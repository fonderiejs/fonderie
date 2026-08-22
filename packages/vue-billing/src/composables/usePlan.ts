import type { IPlanDTO } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUsePlanReturn {
	plan: Ref<IPlanDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
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
	const plan = ref<IPlanDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getPlan(planId, { bust: opts?.force });
			plan.value = result.plan;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { plan, isLoading, error, refresh };
}
