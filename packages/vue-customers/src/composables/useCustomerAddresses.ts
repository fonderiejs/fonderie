import type { IAddAddressInput, ICustomerAddressDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseCustomerAddressesReturn {
	addresses: Ref<ICustomerAddressDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addAddress: (input: IAddAddressInput) => Promise<ICustomerAddressDTO>;
	updateAddressLabel: (addrId: string, label: string) => Promise<void>;
	setPrimaryAddress: (addrId: string) => Promise<void>;
	removeAddress: (addrId: string) => Promise<void>;
}

export function useCustomerAddresses(
	customerId: MaybeRefOrGetter<string>,
): IUseCustomerAddressesReturn;
export function useCustomerAddresses(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
): IUseCustomerAddressesReturn;
export function useCustomerAddresses(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerId?: MaybeRefOrGetter<string>,
): IUseCustomerAddressesReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerId as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerAddresses');
	const addresses = ref<ICustomerAddressDTO[]>([]);
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
			const { result } = await customers.listAddresses(toValue(customerId), { bust: opts?.force });
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
			const { result } = await customers.addAddress(toValue(customerId), input);
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
			await customers.updateAddressLabel(toValue(customerId), addrId, label);
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
			await customers.setPrimaryAddress(toValue(customerId), addrId);
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
			await customers.removeAddress(toValue(customerId), addrId);
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
