import type { FonderieApiError, IAddAddressInput, ICustomerAddressDTO } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseCustomerAddressesReturn {
	addresses: ICustomerAddressDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addAddress: (input: IAddAddressInput) => Promise<ICustomerAddressDTO>;
	updateAddressLabel: (addrId: string, label: string) => Promise<void>;
	setPrimaryAddress: (addrId: string) => Promise<void>;
	removeAddress: (addrId: string) => Promise<void>;
}

const NONE: ICustomerAddressDTO[] = [];

// One customer's addresses: shown at once when seen before, refreshed behind
// what is shown; any write under /customers marks it stale everywhere.
export function useCustomerAddresses(customerId: string): IUseCustomerAddressesReturn;
export function useCustomerAddresses(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerAddressesReturn;
export function useCustomerAddresses(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerAddressesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerAddresses');
	const q = useScopedQuery(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}/addresses`,
		async (bust) => (await customers.listAddresses(customerId, { bust })).result.addresses,
		// Nothing to read until there is a customer.
		{ enabled: !!customerId },
	);
	const w = useWrite(q.refresh);
	const addAddress = useCallback(
		(input: IAddAddressInput) =>
			w.run(async () => (await customers.addAddress(customerId, input)).result.address),
		[customers, customerId, w.run],
	);
	const updateAddressLabel = useCallback(
		(addrId: string, label: string) =>
			w.run(async () => {
				await customers.updateAddressLabel(customerId, addrId, label);
			}),
		[customers, customerId, w.run],
	);
	const setPrimaryAddress = useCallback(
		(addrId: string) =>
			w.run(async () => {
				await customers.setPrimaryAddress(customerId, addrId);
			}),
		[customers, customerId, w.run],
	);
	const removeAddress = useCallback(
		(addrId: string) =>
			w.run(async () => {
				await customers.removeAddress(customerId, addrId);
			}),
		[customers, customerId, w.run],
	);
	return {
		addresses: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		addAddress, updateAddressLabel, setPrimaryAddress, removeAddress,
	};
}
