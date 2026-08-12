import type {
	CustomersClient,
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	IUpdateCustomerInput,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// depth 2 (default) nests relationships one level deeper than depth 1 — see
// ICustomerDetailD2DTO. Pass depth: 1 for a flatter shape.
export function useCustomer(client: CustomersClient, customerId: string, depth: 1 | 2 = 2) {
	const customer = ref<ICustomerDetailDTO | ICustomerDetailD2DTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		if (!customerId) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.getCustomer(customerId, { depth });
			customer.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function updateCustomer(input: IUpdateCustomerInput) {
		error.value = null;
		try {
			await client.updateCustomer(customerId, input);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { customer, isLoading, error, refresh, updateCustomer };
}
