import type { IRecordUsageInput } from '@fonderie/client';
import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseUsageReturn {
	total: Ref<number | null>;
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
	const total = ref<number | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getUsage(toValue(metric), { bust: opts?.force });
			total.value = result.total;
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

	return { total, isLoading, error, refresh, recordUsage };
}
