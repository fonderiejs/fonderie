import type { IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseCustomerPhonesReturn {
	phones: Ref<ICustomerPhoneDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addPhone: (input: IAddPhoneInput) => Promise<ICustomerPhoneDTO>;
	updatePhoneLabel: (phoneId: string, label: string) => Promise<void>;
	setPrimaryPhone: (phoneId: string) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

export function useCustomerPhones(customerId: MaybeRefOrGetter<string>): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerId?: MaybeRefOrGetter<string>,
): IUseCustomerPhonesReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerId as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerPhones');
	const phones = ref<ICustomerPhoneDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		if (!toValue(customerId)) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await customers.listPhones(toValue(customerId), { bust: opts?.force });
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
			const { result } = await customers.addPhone(toValue(customerId), input);
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
			await customers.updatePhoneLabel(toValue(customerId), phoneId, label);
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
			await customers.setPrimaryPhone(toValue(customerId), phoneId);
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
			await customers.removePhone(toValue(customerId), phoneId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(customerId),
		() => void refresh(),
	);

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
