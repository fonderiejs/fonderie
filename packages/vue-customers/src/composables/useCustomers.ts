import type { ICreateCustomerInput, ICustomerDTO, IListCustomersInput } from '@fonderie/client';
import { CustomersClient, type FonderieApiError, queryParams } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseCustomersReturn {
	customers: Ref<ICustomerDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Pagination over the same params: total matching rows server-side,
	// whether more pages exist, and an append-fetch of the next page.
	total: Ref<number>;
	hasMore: Ref<boolean>;
	loadMore: () => Promise<void>;
	createCustomer: (input?: ICreateCustomerInput) => Promise<ICustomerDTO>;
	deleteCustomer: (customerId: string) => Promise<void>;
	blacklistCustomer: (customerId: string, reason?: string) => Promise<void>;
	unblacklistCustomer: (customerId: string) => Promise<void>;
}

export function useCustomers(
	params?: MaybeRefOrGetter<IListCustomersInput | undefined>,
): IUseCustomersReturn;
export function useCustomers(
	client: CustomersClient | undefined,
	params?: MaybeRefOrGetter<IListCustomersInput | undefined>,
): IUseCustomersReturn;
export function useCustomers(
	clientOrParams?: CustomersClient | MaybeRefOrGetter<IListCustomersInput | undefined>,
	maybeParams?: MaybeRefOrGetter<IListCustomersInput | undefined>,
): IUseCustomersReturn {
	const firstIsClient = clientOrParams === undefined || clientOrParams instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrParams as CustomersClient | undefined) : undefined;
	const rawParams = firstIsClient
		? maybeParams
		: (clientOrParams as MaybeRefOrGetter<IListCustomersInput | undefined>);
	const resolveParams = (): IListCustomersInput => toValue(rawParams) ?? {};
	const customersClient = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomers');
	// The first page is the shared, cached read, keyed by the filters and the
	// starting offset (so lists starting elsewhere never share an entry);
	// loadMore appends by offset.
	const start = () => resolveParams().offset ?? 0;
	const page = (from: number, rows: ICustomerDTO[], total: number) => ({
		rows,
		total,
		next: from + rows.length < total ? from + rows.length : null,
	});
	const q = usePagedQuery<ICustomerDTO, number>(
		customersClient,
		() => `/customers${queryParams({ ...resolveParams(), offset: undefined })}${start() ? `#from=${start()}` : ''}`,
		async (bust) => {
			const { result } = await customersClient.listCustomers(resolveParams(), { bust });
			return page(start(), result.customers, result.total);
		},
		async (offset) => {
			const { result } = await customersClient.listCustomers({ ...resolveParams(), offset });
			return page(offset, result.customers, result.total);
		},
		// loadMore here never threw: a list's onEndReached calls it fire-and-forget.
		// A failed page is reported on `error` only.
		{ rethrowLoadMore: false },
	);
	const w = useWrite(() => q.refresh());
	return {
		customers: q.rows,
		// The old composable reported loading during loadMore too.
		isLoading: computed(() => q.isLoading.value || q.isLoadingMore.value),
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		total: computed(() => q.total.value ?? 0),
		hasMore: q.hasMore,
		loadMore: q.loadMore,
		createCustomer: (input = {}) => w.run(async () => (await customersClient.createCustomer(input)).result.customer),
		deleteCustomer: (customerId) =>
			w.run(async () => {
				await customersClient.deleteCustomer(customerId);
			}),
		blacklistCustomer: (customerId, reason) =>
			w.run(async () => {
				await customersClient.blacklistCustomer(customerId, reason !== undefined ? { reason } : {});
			}),
		unblacklistCustomer: (customerId) =>
			w.run(async () => {
				await customersClient.unblacklistCustomer(customerId);
			}),
	};
}
