import type { IAddAddressInput, ICustomerAddressDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerAddressesReturn {
	addresses: ICustomerAddressDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addAddress: (input: IAddAddressInput) => Promise<ICustomerAddressDTO>;
	updateAddressLabel: (addrId: string, label: string) => Promise<void>;
	setPrimaryAddress: (addrId: string) => Promise<void>;
	removeAddress: (addrId: string) => Promise<void>;
}

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
	const [addresses, setAddresses] = useState<ICustomerAddressDTO[]>([]);
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
			const { result } = await customers.listAddresses(customerId);
			setAddresses(result.addresses);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId]);

	const addAddress = useCallback(
		async (input: IAddAddressInput) => {
			setError(null);
			try {
				const { result } = await customers.addAddress(customerId, input);
				await refresh();
				return result.address;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const updateAddressLabel = useCallback(
		async (addrId: string, label: string) => {
			setError(null);
			try {
				await customers.updateAddressLabel(customerId, addrId, label);
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

	const setPrimaryAddress = useCallback(
		async (addrId: string) => {
			setError(null);
			try {
				await customers.setPrimaryAddress(customerId, addrId);
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

	const removeAddress = useCallback(
		async (addrId: string) => {
			setError(null);
			try {
				await customers.removeAddress(customerId, addrId);
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
