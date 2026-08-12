import type { CustomerLabelType, CustomersClient, ICustomerLabelDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// Shared vocabulary across all customers in the workspace (see
// CustomersClient.listLabels) — not tied to a single customer. New labels
// are created implicitly via addEmail/addPhone/addAddress's `label` string;
// this composable is for browsing/pruning the vocabulary directly.
export function useCustomerLabels(client: CustomersClient, type: CustomerLabelType) {
	const labels = ref<ICustomerLabelDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listLabels(type);
			labels.value = result.labels;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function removeLabel(labelId: string) {
		error.value = null;
		try {
			await client.removeLabel(labelId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { labels, isLoading, error, refresh, removeLabel };
}
