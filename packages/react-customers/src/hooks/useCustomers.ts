import type { FonderieApiError, ICreateCustomerInput, ICustomerDTO, IListCustomersInput } from '@fonderie/client';
import { CustomersClient, queryParams } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery, useWrite } from '@fonderie/react';
import { useCallback, useMemo } from 'react';

export interface IUseCustomersReturn {
	customers: ICustomerDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Pagination over the same params: total matching rows server-side,
	// whether more pages exist, and an append-fetch of the next page.
	total: number;
	hasMore: boolean;
	loadMore: () => Promise<void>;
	createCustomer: (input?: ICreateCustomerInput) => Promise<ICustomerDTO>;
	deleteCustomer: (customerId: string) => Promise<void>;
	blacklistCustomer: (customerId: string, reason?: string) => Promise<void>;
	unblacklistCustomer: (customerId: string) => Promise<void>;
}

export function useCustomers(params?: IListCustomersInput): IUseCustomersReturn;
export function useCustomers(
	client: CustomersClient | undefined,
	params?: IListCustomersInput,
): IUseCustomersReturn;
export function useCustomers(
	clientOrParams?: CustomersClient | IListCustomersInput,
	maybeParams?: IListCustomersInput,
): IUseCustomersReturn {
	const firstIsClient = clientOrParams === undefined || clientOrParams instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrParams as CustomersClient | undefined) : undefined;
	const rawParams = (firstIsClient ? maybeParams : clientOrParams) ?? {};
	// Named `client` (not `customers`) to avoid shadowing the list below.
	const client = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomers');
	// Keyed by content, not identity: callers pass a fresh {} on every render.
	const key = queryParams(rawParams);
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on content, not identity
	const params = useMemo(() => rawParams, [key]);
	const start = params.offset ?? 0;

	// Offset pagination: the "cursor" is the offset of the next page.
	const pageOf = (offset: number, customers: ICustomerDTO[], total: number) => ({
		rows: customers,
		total,
		next: offset + customers.length < total ? offset + customers.length : null,
	});
	const q = usePagedQuery<ICustomerDTO, number>(
		client,
		`/customers${queryParams({ ...params, offset: undefined })}${start ? `#from=${start}` : ''}`,
		async (bust) => {
			const { result } = await client.listCustomers(params, { bust });
			return pageOf(start, result.customers, result.total);
		},
		async (offset) => {
			const { result } = await client.listCustomers({ ...params, offset });
			return pageOf(offset, result.customers, result.total);
		},
		// loadMore here never threw: a list's onEndReached calls it fire-and-forget.
		// A failed page is reported on `error` only.
		{ rethrowLoadMore: false },
	);
	const w = useWrite(q.refresh);

	const createCustomer = useCallback(
		(input: ICreateCustomerInput = {}) => w.run(async () => (await client.createCustomer(input)).result.customer),
		[client, w.run],
	);
	const deleteCustomer = useCallback(
		(customerId: string) =>
			w.run(async () => {
				await client.deleteCustomer(customerId);
			}),
		[client, w.run],
	);
	const blacklistCustomer = useCallback(
		(customerId: string, reason?: string) =>
			w.run(async () => {
				await client.blacklistCustomer(customerId, reason !== undefined ? { reason } : {});
			}),
		[client, w.run],
	);
	const unblacklistCustomer = useCallback(
		(customerId: string) =>
			w.run(async () => {
				await client.unblacklistCustomer(customerId);
			}),
		[client, w.run],
	);

	return {
		customers: q.rows,
		// Busy covers "nothing yet" AND a page append, as before: a list UI
		// disables its "more" button on it.
		isLoading: q.isLoading || q.isLoadingMore,
		error: w.error ?? q.error,
		refresh: q.refresh,
		total: q.total ?? 0,
		hasMore: q.hasMore,
		loadMore: q.loadMore,
		createCustomer,
		deleteCustomer,
		blacklistCustomer,
		unblacklistCustomer,
	};
}
