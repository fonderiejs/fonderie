import type { FonderieApiError, ICustomerDetailD2DTO, ICustomerDetailDTO, IUpdateCustomerInput } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseCustomerReturn {
	customer: ICustomerDetailDTO | ICustomerDetailD2DTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateCustomer: (input: IUpdateCustomerInput) => Promise<void>;
	/** Refused with 409 CUSTOMER_IN_USE while a job, quote or invoice references the customer — archive instead. */
	deleteCustomer: () => Promise<void>;
	archiveCustomer: () => Promise<void>;
	unarchiveCustomer: () => Promise<void>;
}

// depth 2 (default) nests relationships one level deeper than depth 1 — see
// ICustomerDetailD2DTO. Pass depth: 1 for a flatter shape.
export function useCustomer(customerId: string, depth?: 1 | 2): IUseCustomerReturn;
export function useCustomer(
	client: CustomersClient | undefined,
	customerId: string,
	depth?: 1 | 2,
): IUseCustomerReturn;
export function useCustomer(
	clientOrId: CustomersClient | string | undefined,
	idOrDepth?: string | 1 | 2,
	maybeDepth?: 1 | 2,
): IUseCustomerReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (idOrDepth as string) : clientOrId;
	const depth = (firstIsClient ? maybeDepth : (idOrDepth as 1 | 2 | undefined)) ?? 2;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomer');
	const q = useScopedQuery<ICustomerDetailDTO | ICustomerDetailD2DTO>(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}${depth === 1 ? '?depth=1' : ''}`,
		async (bust) => (await customers.getCustomer(customerId, { depth }, { bust })).result,
		{ enabled: !!customerId },
	);
	const w = useWrite(q.refresh);
	const updateCustomer = useCallback(
		(input: IUpdateCustomerInput) =>
			w.run(async () => {
				await customers.updateCustomer(customerId, input);
			}),
		[customers, customerId, w.run],
	);
	const deleteCustomer = useCallback(
		() =>
			w.run(async () => {
				await customers.deleteCustomer(customerId);
			}),
		[customers, customerId, w.run],
	);
	const archiveCustomer = useCallback(
		() =>
			w.run(async () => {
				await customers.archiveCustomer(customerId);
			}),
		[customers, customerId, w.run],
	);
	const unarchiveCustomer = useCallback(
		() =>
			w.run(async () => {
				await customers.unarchiveCustomer(customerId);
			}),
		[customers, customerId, w.run],
	);
	return {
		customer: q.data ?? null,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		updateCustomer,
		deleteCustomer,
		archiveCustomer,
		unarchiveCustomer,
	};
}
