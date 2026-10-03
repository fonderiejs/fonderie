import type {
	BillingClient,
	FonderieApiError,
	ICreatePlanInput,
	IPlanDTO,
	IUpdatePlanInput,
} from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import { toApiError, useBillingQuery } from './workspace';

export interface IUsePlansReturn {
	plans: Ref<IPlanDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createPlan: (input: ICreatePlanInput) => Promise<IPlanDTO>;
	updatePlan: (planId: string, input: IUpdatePlanInput) => Promise<IPlanDTO>;
	deletePlan: (planId: string) => Promise<void>;
}

const NO_PLANS: IPlanDTO[] = [];

export function usePlans(client?: BillingClient): IUsePlansReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePlans');
	// The catalog is the same for every subscriber: not keyed by workspace.
	const q = useBillingQuery<IPlanDTO[]>(billing, '/plans', async (bust) => (await billing.listPlans({ bust })).result.plans, {
		perWorkspace: false,
	});
	const writeError = ref<FonderieApiError | null>(null);

	// These writes are not auth-gated by @fonderie/billing —
	// gate the UI that calls them behind your own admin check before shipping it.
	async function write<R>(run: () => Promise<R>): Promise<R> {
		writeError.value = null;
		try {
			const out = await run();
			await q.refresh();
			return out;
		} catch (err) {
			const apiError = toApiError(err);
			writeError.value = apiError;
			throw apiError;
		}
	}

	return {
		plans: computed(() => q.data.value ?? NO_PLANS),
		isLoading: q.isLoading,
		error: computed(() => writeError.value ?? q.error.value),
		refresh: q.refresh,
		createPlan: (input) => write(async () => (await billing.createPlan(input)).result.plan),
		updatePlan: (planId, input) => write(async () => (await billing.updatePlan(planId, input)).result.plan),
		deletePlan: (planId) =>
			write(async () => {
				await billing.deletePlan(planId);
			}),
	};
}
