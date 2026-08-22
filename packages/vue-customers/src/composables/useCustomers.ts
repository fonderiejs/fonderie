import type { ICreateCustomerInput, ICustomerDTO, IListCustomersInput } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

export interface IUseCustomersReturn {
	customers: Ref<ICustomerDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: () => Promise<void>;
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

export function useCustomers(params?: IListCustomersInput): IUseCustomersReturn;
export function useCustomers(
	client: CustomersClient | undefined,
	params?: IListCustomersInput,
): IUseCustomersReturn;
export function useCustomers(
	clientOrParams?: CustomersClient | IListCustomersInput,
	maybeParams?: IListCustomersInput,
): IUseCustomersReturn {
	const firstIsClient = clientOrParams === undefined || clientOrParams instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrParams as CustomersClient | undefined) : undefined;
	const params = (firstIsClient ? maybeParams : clientOrParams) ?? {};
	const customersClient = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomers');
	const customers = ref<ICustomerDTO[]>([]);
	const total = ref(0);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	const hasMore = computed(() => customers.value.length < total.value);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await customersClient.listCustomers(params);
			customers.value = result.customers;
			total.value = result.total;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function loadMore() {
		if (isLoading.value || customers.value.length >= total.value) return;
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await customersClient.listCustomers({ ...params, offset: customers.value.length });
			customers.value = [...customers.value, ...result.customers];
			total.value = result.total;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function createCustomer(input: ICreateCustomerInput = {}) {
		error.value = null;
		try {
			const { result } = await customersClient.createCustomer(input);
			await refresh();
			return result.customer;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function deleteCustomer(customerId: string) {
		error.value = null;
		try {
			await customersClient.deleteCustomer(customerId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function blacklistCustomer(customerId: string, reason?: string) {
		error.value = null;
		try {
			await customersClient.blacklistCustomer(customerId, reason !== undefined ? { reason } : {});
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function unblacklistCustomer(customerId: string) {
		error.value = null;
		try {
			await customersClient.unblacklistCustomer(customerId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return {
		customers,
		isLoading,
		error,
		refresh,
		total,
		hasMore,
		loadMore,
		createCustomer,
		deleteCustomer,
		blacklistCustomer,
		unblacklistCustomer,
	};
}
