import type {
	CustomersClient,
	ICustomerDetailD2DTO,
	ICustomerDetailDTO,
	IUpdateCustomerInput,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
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
export function useCustomer(
	client: CustomersClient,
	customerId: string,
	depth: 1 | 2 = 2,
): IUseCustomerReturn {
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
			const { result } = await client.getCustomer(customerId, { depth });
			setCustomer(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, customerId, depth]);

	const updateCustomer = useCallback(
		async (input: IUpdateCustomerInput) => {
			setError(null);
			try {
				await client.updateCustomer(customerId, input);
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

	return { customer, isLoading, error, refresh, updateCustomer };
}
