import type {
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	IUpdateCustomerInput,
} from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseCustomerReturn {
	customer: Ref<ICustomerDetailDTO | ICustomerDetailD2DTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateCustomer: (input: IUpdateCustomerInput) => Promise<void>;
}

// depth 2 (default) nests relationships one level deeper than depth 1 — see
// ICustomerDetailD2DTO. Pass depth: 1 for a flatter shape.
export function useCustomer(
	customerId: MaybeRefOrGetter<string>,
	depth?: MaybeRefOrGetter<1 | 2>,
): IUseCustomerReturn;
export function useCustomer(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
	depth?: MaybeRefOrGetter<1 | 2>,
): IUseCustomerReturn;
export function useCustomer(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	customerIdOrDepth?: MaybeRefOrGetter<string> | MaybeRefOrGetter<1 | 2>,
	maybeDepth?: MaybeRefOrGetter<1 | 2>,
): IUseCustomerReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (customerIdOrDepth as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const depth = firstIsClient
		? maybeDepth
		: (customerIdOrDepth as MaybeRefOrGetter<1 | 2> | undefined);
	const resolveDepth = () => toValue(depth) ?? 2;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomer');
	// The key follows the id and depth; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		customers,
		() => `/customers/${encodeURIComponent(toValue(customerId))}${resolveDepth() === 1 ? '?depth=1' : ''}`,
		async (bust) => (await customers.getCustomer(toValue(customerId), { depth: resolveDepth() }, { bust })).result,
		{ enabled: () => !!toValue(customerId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		customer: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		updateCustomer: (input) =>
			w.run(async () => {
				await customers.updateCustomer(toValue(customerId), input);
			}),
	};
}
