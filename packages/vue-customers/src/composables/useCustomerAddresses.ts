import type { CustomersClient, IAddAddressInput, ICustomerAddressDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCustomerAddresses(client: CustomersClient, customerId: string) {
	const addresses = ref<ICustomerAddressDTO[]>([]);
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
			const { result } = await client.listAddresses(customerId);
			addresses.value = result.addresses;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function addAddress(input: IAddAddressInput) {
		error.value = null;
		try {
			const { result } = await client.addAddress(customerId, input);
			await refresh();
			return result.address;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function updateAddressLabel(addrId: string, label: string) {
		error.value = null;
		try {
			await client.updateAddressLabel(customerId, addrId, label);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function setPrimaryAddress(addrId: string) {
		error.value = null;
		try {
			await client.setPrimaryAddress(customerId, addrId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeAddress(addrId: string) {
		error.value = null;
		try {
			await client.removeAddress(customerId, addrId);
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
		addresses,
		isLoading,
		error,
		refresh,
		addAddress,
		updateAddressLabel,
		setPrimaryAddress,
		removeAddress,
	};
}
