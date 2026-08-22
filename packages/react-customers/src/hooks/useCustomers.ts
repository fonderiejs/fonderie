import type { ICreateCustomerInput, ICustomerDTO, IListCustomersInput } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface IUseCustomersReturn {
	customers: ICustomerDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
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
	// Named `client` (not `customers`) to avoid shadowing the list state below.
	const client = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomers');
	// Memoized by value (not reference) — `rawParams` defaults to a fresh {}
	// on every render when the caller omits it, which would otherwise refetch
	// on every render regardless of the dependency list below.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on content, not identity
	const params = useMemo(() => rawParams, [JSON.stringify(rawParams)]);

	const [customers, setCustomers] = useState<ICustomerDTO[]>([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listCustomers(params);
			setCustomers(result.customers);
			setTotal(result.total);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, params]);

	const loadMore = useCallback(async () => {
		if (isLoading || customers.length >= total) return;
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listCustomers({ ...params, offset: customers.length });
			setCustomers((prev) => [...prev, ...result.customers]);
			setTotal(result.total);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, params, customers.length, total, isLoading]);

	const createCustomer = useCallback(
		async (input: ICreateCustomerInput = {}) => {
			setError(null);
			try {
				const { result } = await client.createCustomer(input);
				await refresh();
				return result.customer;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	const deleteCustomer = useCallback(
		async (customerId: string) => {
			setError(null);
			try {
				await client.deleteCustomer(customerId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	const blacklistCustomer = useCallback(
		async (customerId: string, reason?: string) => {
			setError(null);
			try {
				await client.blacklistCustomer(customerId, reason !== undefined ? { reason } : {});
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	const unblacklistCustomer = useCallback(
		async (customerId: string) => {
			setError(null);
			try {
				await client.unblacklistCustomer(customerId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		customers,
		isLoading,
		error,
		refresh,
		total,
		hasMore: customers.length < total,
		loadMore,
		createCustomer,
		deleteCustomer,
		blacklistCustomer,
		unblacklistCustomer,
	};
}
