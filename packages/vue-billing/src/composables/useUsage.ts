import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseUsageReturn {
	total: Ref<number | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: () => Promise<void>;
}

export function useUsage(metric: string): IUseUsageReturn;
export function useUsage(client: BillingClient | undefined, metric: string): IUseUsageReturn;
export function useUsage(
	clientOrMetric: BillingClient | string | undefined,
	maybeMetric?: string,
): IUseUsageReturn {
	const firstIsClient = clientOrMetric === undefined || clientOrMetric instanceof BillingClient;
	const explicit = firstIsClient ? (clientOrMetric as BillingClient | undefined) : undefined;
	const metric = firstIsClient ? (maybeMetric as string) : clientOrMetric;
	const billing = useFonderieSubClient(explicit, (c) => c.billing, 'useUsage');
	const total = ref<number | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getUsage(metric);
			total.value = result.total;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { total, isLoading, error, refresh };
}
