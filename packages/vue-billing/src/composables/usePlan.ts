import type { IPlanDTO } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUsePlanReturn {
	plan: Ref<IPlanDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

export function usePlan(planId: MaybeRefOrGetter<string>): IUsePlanReturn;
export function usePlan(
	client: BillingClient | undefined,
	planId: MaybeRefOrGetter<string>,
): IUsePlanReturn;
export function usePlan(
	clientOrPlanId: BillingClient | MaybeRefOrGetter<string> | undefined,
	maybePlanId?: MaybeRefOrGetter<string>,
): IUsePlanReturn {
	const firstIsClient = clientOrPlanId === undefined || clientOrPlanId instanceof BillingClient;
	const explicit = firstIsClient ? (clientOrPlanId as BillingClient | undefined) : undefined;
	const planId = firstIsClient ? (maybePlanId as MaybeRefOrGetter<string>) : clientOrPlanId;
	const billing = useFonderieSubClient(explicit, (c) => c.billing, 'usePlan');
	const plan = ref<IPlanDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getPlan(toValue(planId), { bust: opts?.force });
			plan.value = result.plan;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(planId),
		() => void refresh(),
	);

	return { plan, isLoading, error, refresh };
}
