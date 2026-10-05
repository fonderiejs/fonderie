import type { IAddRelationshipInput, ICustomerRelationshipDTO } from '@fonderie/client';
import { CustomersClient, type FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

import type { ICustomerSectionOptions } from './section-options';

export interface IUseCustomerRelationshipsReturn {
	relationships: Ref<ICustomerRelationshipDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addRelationship: (input: IAddRelationshipInput) => Promise<ICustomerRelationshipDTO>;
	setPrimaryRelationship: (relatedId: string) => Promise<void>;
	removeRelationship: (relatedId: string) => Promise<void>;
}

export function useCustomerRelationships(customerId: MaybeRefOrGetter<string>, opts?: ICustomerSectionOptions): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	client: CustomersClient | undefined,
	customerId: MaybeRefOrGetter<string>,
	opts?: ICustomerSectionOptions,
): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	clientOrCustomerId: CustomersClient | MaybeRefOrGetter<string> | undefined,
	maybeCustomerIdOrOpts?: MaybeRefOrGetter<string> | ICustomerSectionOptions,
	maybeOpts?: ICustomerSectionOptions,
): IUseCustomerRelationshipsReturn {
	const firstIsClient =
		clientOrCustomerId === undefined || clientOrCustomerId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrCustomerId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient
		? (maybeCustomerIdOrOpts as MaybeRefOrGetter<string>)
		: clientOrCustomerId;
	const read = ((firstIsClient ? maybeOpts : maybeCustomerIdOrOpts) as ICustomerSectionOptions | undefined)?.read !== false;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerRelationships');
	// The key follows the id; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		customers,
		() => `/customers/${encodeURIComponent(toValue(customerId))}/relationships`,
		async (bust) => (await customers.listRelationships(toValue(customerId), { bust })).result.relationships,
		{ enabled: () => read && !!toValue(customerId) },
	);
	const w = useWrite(() => q.refresh());
	return {
		relationships: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		addRelationship: (input) => w.run(async () => (await customers.addRelationship(toValue(customerId), input)).result.relationship),
		setPrimaryRelationship: (relatedId) =>
			w.run(async () => {
				await customers.setPrimaryRelationship(toValue(customerId), relatedId);
			}),
		removeRelationship: (relatedId) =>
			w.run(async () => {
				await customers.removeRelationship(toValue(customerId), relatedId);
			}),
	};
}
