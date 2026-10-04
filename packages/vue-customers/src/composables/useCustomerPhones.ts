import type { IAddPhoneInput, ICustomerPhoneDTO } from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

import type { ICustomerSectionOptions } from './section-options';

export interface IUseCustomerPhonesReturn {
	phones: Ref<ICustomerPhoneDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addPhone: (input: IAddPhoneInput) => Promise<ICustomerPhoneDTO>;
	updatePhoneLabel: (phoneId: string, label: string) => Promise<void>;
	setPrimaryPhone: (phoneId: string) => Promise<void>;
	removePhone: (phoneId: string) => Promise<void>;
}

export function useCustomerPhones(customerId: MaybeRefOrGetter<string>, opts?: ICustomerSectionOptions): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
	opts?: ICustomerSectionOptions,
): IUseCustomerPhonesReturn;
export function useCustomerPhones(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerIdOrOpts?: MaybeRefOrGetter<string> | ICustomerSectionOptions,
	maybeOpts?: ICustomerSectionOptions,
): IUseCustomerPhonesReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerIdOrOpts as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const read = ((firstIsClient ? maybeOpts : maybeCustomerIdOrOpts) as ICustomerSectionOptions | undefined)?.read !== false;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerPhones');
	// The key follows the id; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		customers,
		() => `/customers/${encodeURIComponent(toValue(customerId))}/phones`,
		async (bust) => (await customers.listPhones(toValue(customerId), { bust })).result.phones,
		{ enabled: () => read && !!toValue(customerId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		phones: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		addPhone: (input) => w.run(async () => (await customers.addPhone(toValue(customerId), input)).result.phone),
		updatePhoneLabel: (phoneId, label) =>
			w.run(async () => {
				await customers.updatePhoneLabel(toValue(customerId), phoneId, label);
			}),
		setPrimaryPhone: (phoneId) =>
			w.run(async () => {
				await customers.setPrimaryPhone(toValue(customerId), phoneId);
			}),
		removePhone: (phoneId) =>
			w.run(async () => {
				await customers.removePhone(toValue(customerId), phoneId);
			}),
	};
}
