import type { IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCustomerPhonesReturn {
	phones: Ref<ICustomerPhoneDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: () => Promise<void>;
	addPhone: (input: IAddPhoneInput) => Promise<ICustomerPhoneDTO>;
	updatePhoneLabel: (phoneId: string, label: string) => Promise<void>;
	setPrimaryPhone: (phoneId: string) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

export function useCustomerPhones(customerId: string): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	clientOrCustomerId: CustomersClient | string | undefined,
	maybeCustomerId?: string,
): IUseCustomerPhonesReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeCustomerId as string) : clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerPhones');
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
			const { result } = await customers.listPhones(customerId);
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
			const { result } = await customers.addPhone(customerId, input);
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
			await customers.updatePhoneLabel(customerId, phoneId, label);
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
			await customers.setPrimaryPhone(customerId, phoneId);
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
			await customers.removePhone(customerId, phoneId);
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
