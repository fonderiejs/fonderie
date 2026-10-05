import type { CustomerLabelType, ICustomerLabelDTO } from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

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
export function useCustomerLabels(
	type: MaybeRefOrGetter<CustomerLabelType>,
): IUseCustomerLabelsReturn;
export function useCustomerLabels(
	client: CustomersClient | undefined,
	type: MaybeRefOrGetter<CustomerLabelType>,
): IUseCustomerLabelsReturn;
export function useCustomerLabels(
	clientOrType: CustomersClient | MaybeRefOrGetter<CustomerLabelType> | undefined,
	maybeType?: MaybeRefOrGetter<CustomerLabelType>,
): IUseCustomerLabelsReturn {
	const firstIsClient = clientOrType === undefined || clientOrType instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrType as CustomersClient | undefined) : undefined;
	const type = firstIsClient ? (maybeType as MaybeRefOrGetter<CustomerLabelType>) : clientOrType;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerLabels');
	// The key follows the type: another type reads that vocabulary's entry.
	const q = useScopedQuery(
		customers,
		() => `/customers/labels?type=${encodeURIComponent(toValue(type))}`,
		async (bust) => (await customers.listLabels(toValue(type), { bust })).result.labels,
	);
	const w = useWrite(() => q.refresh());
	return {
		labels: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		removeLabel: (labelId) =>
			w.run(async () => {
				await customers.removeLabel(labelId);
			}),
	};
}
