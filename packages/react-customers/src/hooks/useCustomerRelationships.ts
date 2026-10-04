import type { FonderieApiError, IAddRelationshipInput, ICustomerRelationshipDTO } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

import type { ICustomerSectionOptions } from './section-options';

export interface IUseCustomerRelationshipsReturn {
	relationships: ICustomerRelationshipDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addRelationship: (input: IAddRelationshipInput) => Promise<ICustomerRelationshipDTO>;
	setPrimaryRelationship: (relatedId: string) => Promise<void>;
	removeRelationship: (relatedId: string) => Promise<void>;
}

const NONE: ICustomerRelationshipDTO[] = [];

// One customer's relationships: shown at once when seen before, refreshed behind
// what is shown; any write under /customers marks it stale everywhere.
export function useCustomerRelationships(customerId: string, opts?: ICustomerSectionOptions): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	client: CustomersClient | undefined,
	customerId: string,
	opts?: ICustomerSectionOptions,
): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	clientOrId: CustomersClient | string | undefined,
	maybeIdOrOpts?: string | ICustomerSectionOptions,
	maybeOpts?: ICustomerSectionOptions,
): IUseCustomerRelationshipsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeIdOrOpts as string) : clientOrId;
	const read = ((firstIsClient ? maybeOpts : maybeIdOrOpts) as ICustomerSectionOptions | undefined)?.read !== false;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerRelationships');
	const q = useScopedQuery(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}/relationships`,
		async (bust) => (await customers.listRelationships(customerId, { bust })).result.relationships,
		// Nothing to read until there is a customer.
		{ enabled: !!customerId && read },
	);
	const w = useWrite(q.refresh);
	const addRelationship = useCallback(
		(input: IAddRelationshipInput) =>
			w.run(async () => (await customers.addRelationship(customerId, input)).result.relationship),
		[customers, customerId, w.run],
	);
	const setPrimaryRelationship = useCallback(
		(relatedId: string) =>
			w.run(async () => {
				await customers.setPrimaryRelationship(customerId, relatedId);
			}),
		[customers, customerId, w.run],
	);
	const removeRelationship = useCallback(
		(relatedId: string) =>
			w.run(async () => {
				await customers.removeRelationship(customerId, relatedId);
			}),
		[customers, customerId, w.run],
	);
	return {
		relationships: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		addRelationship, setPrimaryRelationship, removeRelationship,
	};
}
