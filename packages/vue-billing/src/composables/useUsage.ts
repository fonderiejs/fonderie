import type { IRecordUsageInput, IUsageResult } from '@fonderie/client';
import { BillingClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { computed, ref, toValue } from 'vue';

import { toApiError, useBillingQuery } from './workspace';

export interface IUseUsageReturn {
	// Used in the current window for a windowed plan limit (e.g. 'api-calls'),
	// else recorded this month. null until the first read resolves.
	total: ComputedRef<number | null>;
	// The whole reading: limit, status ('ok' | 'warning' | 'over_limit' |
	// 'blocked'), window and resetsAt for a windowed plan limit.
	usage: Ref<IUsageResult | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	recordUsage: (input: IRecordUsageInput) => Promise<void>;
}

export function useUsage(metric: MaybeRefOrGetter<string>): IUseUsageReturn;
export function useUsage(
	client: BillingClient | undefined,
	metric: MaybeRefOrGetter<string>,
): IUseUsageReturn;
export function useUsage(
	clientOrMetric: BillingClient | MaybeRefOrGetter<string> | undefined,
	maybeMetric?: MaybeRefOrGetter<string>,
): IUseUsageReturn {
	const firstIsClient = clientOrMetric === undefined || clientOrMetric instanceof BillingClient;
	const explicit = firstIsClient ? (clientOrMetric as BillingClient | undefined) : undefined;
	const metric = firstIsClient ? (maybeMetric as MaybeRefOrGetter<string>) : clientOrMetric;
	const billing = useFonderieSubClient(explicit, (c) => c.billing, 'useUsage');
	// The key follows the metric: changing it reads that metric's entry.
	const q = useBillingQuery<IUsageResult>(
		billing,
		() => `/billing/usage/${encodeURIComponent(toValue(metric))}`,
		async (bust) => (await billing.getUsage(toValue(metric), { bust })).result,
	);
	const writeError = ref<FonderieApiError | null>(null);

	async function recordUsage(input: IRecordUsageInput) {
		writeError.value = null;
		try {
			await billing.recordUsage(input);
			await q.refresh();
		} catch (err) {
			const apiError = toApiError(err);
			writeError.value = apiError;
			throw apiError;
		}
	}

	const usage = computed(() => q.data.value ?? null);
	return {
		total: computed(() => usage.value?.total ?? null),
		usage,
		isLoading: q.isLoading,
		error: computed(() => writeError.value ?? q.error.value),
		refresh: q.refresh,
		recordUsage,
	};
}
