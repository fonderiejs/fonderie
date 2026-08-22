import type { CustomerLabelType, ICustomerLabelDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCustomerLabelsReturn {
	labels: Ref<ICustomerLabelDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	removeLabel: (labelId: string) => Promise<void>;
}

// Shared vocabulary across all customers in the workspace (see
// CustomersClient.listLabels) — not tied to a single customer. New labels
// are created implicitly via addEmail/addPhone/addAddress's `label` string;
// this composable is for browsing/pruning the vocabulary directly.
export function useCustomerLabels(type: CustomerLabelType): IUseCustomerLabelsReturn;
export function useCustomerLabels(
	client: CustomersClient | undefined,
	type: CustomerLabelType,
): IUseCustomerLabelsReturn;
export function useCustomerLabels(
	clientOrType: CustomersClient | CustomerLabelType | undefined,
	maybeType?: CustomerLabelType,
): IUseCustomerLabelsReturn {
	const firstIsClient = clientOrType === undefined || clientOrType instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrType as CustomersClient | undefined) : undefined;
	const type = firstIsClient ? (maybeType as CustomerLabelType) : clientOrType;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerLabels');
	const labels = ref<ICustomerLabelDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await customers.listLabels(type, { bust: opts?.force });
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
			await customers.removeLabel(labelId);
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
