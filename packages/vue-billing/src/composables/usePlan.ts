import type { IPlanDTO } from '@fonderie/client';
import { BillingClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

import { useBillingQuery } from './workspace';

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
	// The catalog is the same for every subscriber: not keyed by workspace.
	const q = useBillingQuery<IPlanDTO>(
		billing,
		() => `/plans/${encodeURIComponent(toValue(planId))}`,
		async (bust) => (await billing.getPlan(toValue(planId), { bust })).result.plan,
		{ perWorkspace: false },
	);
	return { plan: computed(() => q.data.value ?? null), isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
