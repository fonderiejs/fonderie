import type { BillingClient, IRecordUsageInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseRecordUsageReturn {
	recordUsage: (input: IRecordUsageInput) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

/** @deprecated Use useUsage(metric).recordUsage — the list hook self-refreshes after the write. */
export function useRecordUsage(client?: BillingClient): IUseRecordUsageReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useRecordUsage');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function recordUsage(input: IRecordUsageInput) {
		isLoading.value = true;
		error.value = null;
		try {
			await billing.recordUsage(input);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { recordUsage, isLoading, error };
}
