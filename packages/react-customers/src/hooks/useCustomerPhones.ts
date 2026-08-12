import type { CustomersClient, IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerPhonesReturn {
	phones: ICustomerPhoneDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addPhone: (input: IAddPhoneInput) => Promise<ICustomerPhoneDTO>;
	updatePhoneLabel: (phoneId: string, label: string) => Promise<void>;
	setPrimaryPhone: (phoneId: string) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

export function useCustomerPhones(
	client: CustomersClient,
	customerId: string,
): IUseCustomerPhonesReturn {
	const [phones, setPhones] = useState<ICustomerPhoneDTO[]>([]);
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
			const { result } = await client.listPhones(customerId);
			setPhones(result.phones);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, customerId]);

	const addPhone = useCallback(
		async (input: IAddPhoneInput) => {
			setError(null);
			try {
				const { result } = await client.addPhone(customerId, input);
				await refresh();
				return result.phone;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const updatePhoneLabel = useCallback(
		async (phoneId: string, label: string) => {
			setError(null);
			try {
				await client.updatePhoneLabel(customerId, phoneId, label);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const setPrimaryPhone = useCallback(
		async (phoneId: string) => {
			setError(null);
			try {
				await client.setPrimaryPhone(customerId, phoneId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const removePhone = useCallback(
		async (phoneId: string) => {
			setError(null);
			try {
				await client.removePhone(customerId, phoneId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
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
