import type { FonderieApiError, IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

import type { ICustomerSectionOptions } from './section-options';

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

const NONE: ICustomerEmailDTO[] = [];

// One customer's emails: shown at once when seen before, refreshed behind
// what is shown; any write under /customers marks it stale everywhere.
export function useCustomerEmails(customerId: string, opts?: ICustomerSectionOptions): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	client: CustomersClient | undefined,
	customerId: string,
	opts?: ICustomerSectionOptions,
): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	clientOrId: CustomersClient | string | undefined,
	maybeIdOrOpts?: string | ICustomerSectionOptions,
	maybeOpts?: ICustomerSectionOptions,
): IUseCustomerEmailsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeIdOrOpts as string) : clientOrId;
	const read = ((firstIsClient ? maybeOpts : maybeIdOrOpts) as ICustomerSectionOptions | undefined)?.read !== false;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerEmails');
	const q = useScopedQuery(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}/emails`,
		async (bust) => (await customers.listEmails(customerId, { bust })).result.emails,
		// Nothing to read until there is a customer.
		{ enabled: !!customerId && read },
	);
	const w = useWrite(q.refresh);
	const addEmail = useCallback(
		(input: IAddEmailInput) =>
			w.run(async () => (await customers.addEmail(customerId, input)).result.email),
		[customers, customerId, w.run],
	);
	const updateEmailLabel = useCallback(
		(emailId: string, label: string) =>
			w.run(async () => {
				await customers.updateEmailLabel(customerId, emailId, label);
			}),
		[customers, customerId, w.run],
	);
	const setPrimaryEmail = useCallback(
		(emailId: string) =>
			w.run(async () => {
				await customers.setPrimaryEmail(customerId, emailId);
			}),
		[customers, customerId, w.run],
	);
	const removeEmail = useCallback(
		(emailId: string) =>
			w.run(async () => {
				await customers.removeEmail(customerId, emailId);
			}),
		[customers, customerId, w.run],
	);
	return {
		emails: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		addEmail, updateEmailLabel, setPrimaryEmail, removeEmail,
	};
}
