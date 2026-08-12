import type {
	CustomersClient,
	ICreateCustomerInput,
	ICustomerDTO,
	IListCustomersInput,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCustomers(client: CustomersClient, params: IListCustomersInput = {}) {
	const customers = ref<ICustomerDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listCustomers(params);
			customers.value = result.customers;
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
			const { result } = await client.createCustomer(input);
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
			await client.deleteCustomer(customerId);
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
			await client.blacklistCustomer(customerId, reason !== undefined ? { reason } : {});
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
			await client.unblacklistCustomer(customerId);
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
		createCustomer,
		deleteCustomer,
		blacklistCustomer,
		unblacklistCustomer,
	};
}
