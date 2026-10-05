import type { FonderieApiError, IDeletedCustomerDTO, CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseDeletedCustomersReturn {
	customers: IDeletedCustomerDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Back where it was, with the same id.
	restore: (id: string) => Promise<void>;
	// Gone for good — the workspace owner only (403 OWNER_REQUIRED otherwise).
	purge: (id: string) => Promise<void>;
}

const NONE: IDeletedCustomerDTO[] = [];

// The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): what was deleted in
// the selected workspace, restorable until each item's `purgeAt`.
export function useDeletedCustomers(client?: CustomersClient): IUseDeletedCustomersReturn {
	const api = useFonderieSubClient(client, (c) => c.customers, 'useDeletedCustomers');
	const q = useScopedQuery(api, '/customers/bin', async (bust) => (await api.listDeletedCustomers({ bust })).result.customers);
	const w = useWrite(q.refresh);
	const restore = useCallback(
		(id: string) =>
			w.run(async () => {
				await api.restoreCustomer(id);
			}),
		[api, w.run],
	);
	const purge = useCallback(
		(id: string) =>
			w.run(async () => {
				await api.purgeDeletedCustomer(id);
			}),
		[api, w.run],
	);
	return { customers: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, restore, purge };
}
