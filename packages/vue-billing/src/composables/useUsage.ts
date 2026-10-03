import type { IRecordUsageInput, IUsageResult } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';
import { computed, onMounted, ref, toValue, watch } from 'vue';

import { latestRequest, onWorkspaceSwitch } from './workspace';

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
	const usage = ref<IUsageResult | null>(null);
	const total = computed(() => usage.value?.total ?? null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	const beginRequest = latestRequest();

	async function refresh(opts?: { force?: boolean }) {
		const isLatest = beginRequest();
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getUsage(toValue(metric), { bust: opts?.force });
			if (!isLatest()) return;
			usage.value = result;
		} catch (err) {
			if (!isLatest()) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			if (isLatest()) isLoading.value = false;
		}
	}

	// Workspace billing: a switch clears what was shown and re-reads.
	onWorkspaceSwitch(billing, () => {
		usage.value = null;
		error.value = null;
		isLoading.value = true;
		void refresh();
	});
	onMounted(() => void refresh());
	watch(
		() => toValue(metric),
		() => void refresh(),
	);

	async function recordUsage(input: IRecordUsageInput) {
		error.value = null;
		try {
			await billing.recordUsage(input);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { total, usage, isLoading, error, refresh, recordUsage };
}
