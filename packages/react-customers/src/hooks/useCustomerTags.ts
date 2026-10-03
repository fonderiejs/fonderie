import type { FonderieApiError } from '@fonderie/client';
import { CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseCustomerTagsReturn {
	tags: string[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	addTag: (tag: string) => Promise<void>;
	removeTag: (tag: string) => Promise<void>;
}

const NONE: string[] = [];

// One customer's tags: shown at once when seen before, refreshed behind
// what is shown; any write under /customers marks it stale everywhere.
export function useCustomerTags(customerId: string): IUseCustomerTagsReturn;
export function useCustomerTags(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerTagsReturn;
export function useCustomerTags(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerTagsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerTags');
	const q = useScopedQuery(
		customers,
		`/customers/${encodeURIComponent(customerId ?? '')}/tags`,
		async (bust) => (await customers.listTags(customerId, { bust })).result.tags,
		// Nothing to read until there is a customer.
		{ enabled: !!customerId },
	);
	const w = useWrite(q.refresh);
	const addTag = useCallback(
		(tag: string) =>
			w.run(async () => {
				await customers.addTag(customerId, tag);
			}),
		[customers, customerId, w.run],
	);
	const removeTag = useCallback(
		(tag: string) =>
			w.run(async () => {
				await customers.removeTag(customerId, tag);
			}),
		[customers, customerId, w.run],
	);
	return {
		tags: q.data ?? NONE,
		isLoading: q.isLoading,
		error: w.error ?? q.error,
		refresh: q.refresh,
		addTag, removeTag,
	};
}
