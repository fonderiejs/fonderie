import type {
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	IUpdateCustomerInput,
} from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerReturn {
	customer: ICustomerDetailDTO | ICustomerDetailD2DTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	updateCustomer: (input: IUpdateCustomerInput) => Promise<void>;
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
	const [customer, setCustomer] = useState<ICustomerDetailDTO | ICustomerDetailD2DTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!customerId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await customers.getCustomer(customerId, { depth });
			setCustomer(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId, depth]);

	const updateCustomer = useCallback(
		async (input: IUpdateCustomerInput) => {
			setError(null);
			try {
				await customers.updateCustomer(customerId, input);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { customer, isLoading, error, refresh, updateCustomer };
}
