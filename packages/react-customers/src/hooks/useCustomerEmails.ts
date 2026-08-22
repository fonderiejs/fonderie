import type { IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerEmailsReturn {
	emails: ICustomerEmailDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addEmail: (input: IAddEmailInput) => Promise<ICustomerEmailDTO>;
	updateEmailLabel: (emailId: string, label: string) => Promise<void>;
	setPrimaryEmail: (emailId: string) => Promise<void>;
	removeEmail: (emailId: string) => Promise<void>;
}

export function useCustomerEmails(customerId: string): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerEmailsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerEmails');
	const [emails, setEmails] = useState<ICustomerEmailDTO[]>([]);
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
			const { result } = await customers.listEmails(customerId, { bust: opts?.force });
			setEmails(result.emails);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId]);

	const addEmail = useCallback(
		async (input: IAddEmailInput) => {
			setError(null);
			try {
				const { result } = await customers.addEmail(customerId, input);
				await refresh();
				return result.email;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const updateEmailLabel = useCallback(
		async (emailId: string, label: string) => {
			setError(null);
			try {
				await customers.updateEmailLabel(customerId, emailId, label);
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

	const setPrimaryEmail = useCallback(
		async (emailId: string) => {
			setError(null);
			try {
				await customers.setPrimaryEmail(customerId, emailId);
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

	const removeEmail = useCallback(
		async (emailId: string) => {
			setError(null);
			try {
				await customers.removeEmail(customerId, emailId);
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
