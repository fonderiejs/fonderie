import type { IAddEmailInput, ICustomerEmailDTO } from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

import type { ICustomerSectionOptions } from './section-options';

export interface IUseCustomerEmailsReturn {
	emails: Ref<ICustomerEmailDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addEmail: (input: IAddEmailInput) => Promise<ICustomerEmailDTO>;
	updateEmailLabel: (emailId: string, label: string) => Promise<void>;
	setPrimaryEmail: (emailId: string) => Promise<void>;
	removeEmail: (emailId: string) => Promise<void>;
}

export function useCustomerEmails(customerId: MaybeRefOrGetter<string>, opts?: ICustomerSectionOptions): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
	opts?: ICustomerSectionOptions,
): IUseCustomerEmailsReturn;
export function useCustomerEmails(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerIdOrOpts?: MaybeRefOrGetter<string> | ICustomerSectionOptions,
	maybeOpts?: ICustomerSectionOptions,
): IUseCustomerEmailsReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerIdOrOpts as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const read = ((firstIsClient ? maybeOpts : maybeCustomerIdOrOpts) as ICustomerSectionOptions | undefined)?.read !== false;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerEmails');
	// The key follows the id; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		customers,
		() => `/customers/${encodeURIComponent(toValue(customerId))}/emails`,
		async (bust) => (await customers.listEmails(toValue(customerId), { bust })).result.emails,
		{ enabled: () => read && !!toValue(customerId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		emails: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		addEmail: (input) => w.run(async () => (await customers.addEmail(toValue(customerId), input)).result.email),
		updateEmailLabel: (emailId, label) =>
			w.run(async () => {
				await customers.updateEmailLabel(toValue(customerId), emailId, label);
			}),
		setPrimaryEmail: (emailId) =>
			w.run(async () => {
				await customers.setPrimaryEmail(toValue(customerId), emailId);
			}),
		removeEmail: (emailId) =>
			w.run(async () => {
				await customers.removeEmail(toValue(customerId), emailId);
			}),
	};
}
