import type { IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

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
	const [phones, setPhones] = useState<ICustomerPhoneDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async (opts?: { force?: boolean }) => {
		if (!customerId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await customers.listPhones(customerId, { bust: opts?.force });
			setPhones(result.phones);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId]);

	const addPhone = useCallback(
		async (input: IAddPhoneInput) => {
			setError(null);
			try {
				const { result } = await customers.addPhone(customerId, input);
				await refresh();
				return result.phone;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const updatePhoneLabel = useCallback(
		async (phoneId: string, label: string) => {
			setError(null);
			try {
				await customers.updatePhoneLabel(customerId, phoneId, label);
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

	const setPrimaryPhone = useCallback(
		async (phoneId: string) => {
			setError(null);
			try {
				await customers.setPrimaryPhone(customerId, phoneId);
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

	const removePhone = useCallback(
		async (phoneId: string) => {
			setError(null);
			try {
				await customers.removePhone(customerId, phoneId);
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
