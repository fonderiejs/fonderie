import type { FonderieApiError, IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseCustomerPhonesReturn {
	phones: ICustomerPhoneDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addPhone: (input: IAddPhoneInput) => Promise<ICustomerPhoneDTO>;
	updatePhoneLabel: (phoneId: string, label: string) => Promise<void>;
	setPrimaryPhone: (phoneId: string) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

const NONE: ICustomerPhoneDTO[] = [];

// One customer's phones: shown at once when seen before, refreshed behind
// what is shown; any write under /customers marks it stale everywhere.
export function useCustomerPhones(customerId: string): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerPhonesReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerPhones');
	const q = useScopedQuery(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}/phones`,
		async (bust) => (await customers.listPhones(customerId, { bust })).result.phones,
		// Nothing to read until there is a customer.
		{ enabled: !!customerId },
	);
	const w = useWrite(q.refresh);
	const addPhone = useCallback(
		(input: IAddPhoneInput) =>
			w.run(async () => (await customers.addPhone(customerId, input)).result.phone),
		[customers, customerId, w.run],
	);
	const updatePhoneLabel = useCallback(
		(phoneId: string, label: string) =>
			w.run(async () => {
				await customers.updatePhoneLabel(customerId, phoneId, label);
			}),
		[customers, customerId, w.run],
	);
	const setPrimaryPhone = useCallback(
		(phoneId: string) =>
			w.run(async () => {
				await customers.setPrimaryPhone(customerId, phoneId);
			}),
		[customers, customerId, w.run],
	);
	const removePhone = useCallback(
		(phoneId: string) =>
			w.run(async () => {
				await customers.removePhone(customerId, phoneId);
			}),
		[customers, customerId, w.run],
	);
	return {
		phones: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		addPhone, updatePhoneLabel, setPrimaryPhone, removePhone,
	};
}
