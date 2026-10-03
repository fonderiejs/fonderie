import type { IAddAddressInput, ICustomerAddressDTO } from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

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
	// The key follows the id; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		customers,
		() => `/customers/${encodeURIComponent(toValue(customerId))}/addresses`,
		async (bust) => (await customers.listAddresses(toValue(customerId), { bust })).result.addresses,
		{ enabled: () => !!toValue(customerId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		addresses: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		addAddress: (input) => w.run(async () => (await customers.addAddress(toValue(customerId), input)).result.address),
		updateAddressLabel: (addrId, label) =>
			w.run(async () => {
				await customers.updateAddressLabel(toValue(customerId), addrId, label);
			}),
		setPrimaryAddress: (addrId) =>
			w.run(async () => {
				await customers.setPrimaryAddress(toValue(customerId), addrId);
			}),
		removeAddress: (addrId) =>
			w.run(async () => {
				await customers.removeAddress(toValue(customerId), addrId);
			}),
	};
}
