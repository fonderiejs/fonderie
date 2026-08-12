import type { CustomersClient, IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerEmailsReturn {
	emails: ICustomerEmailDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addEmail: (input: IAddEmailInput) => Promise<ICustomerEmailDTO>;
	updateEmailLabel: (emailId: string, label: string) => Promise<void>;
	setPrimaryEmail: (emailId: string) => Promise<void>;
	removeEmail: (emailId: string) => Promise<void>;
}

export function useCustomerEmails(
	client: CustomersClient,
	customerId: string,
): IUseCustomerEmailsReturn {
	const [emails, setEmails] = useState<ICustomerEmailDTO[]>([]);
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
			const { result } = await client.listEmails(customerId);
			setEmails(result.emails);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, customerId]);

	const addEmail = useCallback(
		async (input: IAddEmailInput) => {
			setError(null);
			try {
				const { result } = await client.addEmail(customerId, input);
				await refresh();
				return result.email;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const updateEmailLabel = useCallback(
		async (emailId: string, label: string) => {
			setError(null);
			try {
				await client.updateEmailLabel(customerId, emailId, label);
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

	const setPrimaryEmail = useCallback(
		async (emailId: string) => {
			setError(null);
			try {
				await client.setPrimaryEmail(customerId, emailId);
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

	const removeEmail = useCallback(
		async (emailId: string) => {
			setError(null);
			try {
				await client.removeEmail(customerId, emailId);
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
		emails,
		isLoading,
		error,
		refresh,
		addEmail,
		updateEmailLabel,
		setPrimaryEmail,
		removeEmail,
	};
}
