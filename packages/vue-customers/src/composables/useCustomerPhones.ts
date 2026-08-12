import type { CustomersClient, IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useCustomerPhones(client: CustomersClient, customerId: string) {
	const phones = ref<ICustomerPhoneDTO[]>([]);
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
			const { result } = await client.listPhones(customerId);
			phones.value = result.phones;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function addPhone(input: IAddPhoneInput) {
		error.value = null;
		try {
			const { result } = await client.addPhone(customerId, input);
			await refresh();
			return result.phone;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function updatePhoneLabel(phoneId: string, label: string) {
		error.value = null;
		try {
			await client.updatePhoneLabel(customerId, phoneId, label);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function setPrimaryPhone(phoneId: string) {
		error.value = null;
		try {
			await client.setPrimaryPhone(customerId, phoneId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removePhone(phoneId: string) {
		error.value = null;
		try {
			await client.removePhone(customerId, phoneId);
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
		phones,
		isLoading,
		error,
		refresh,
		addPhone,
		updatePhoneLabel,
		setPrimaryPhone,
		removePhone,
	};
}
