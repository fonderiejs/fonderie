import type { FonderieApiError, IDeletedCustomerDTO, CustomersClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

export interface IUseDeletedCustomersReturn {
	customers: Ref<IDeletedCustomerDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Back where it was, with the same id.
	restore: (id: string) => Promise<void>;
	// Gone for good — the workspace owner only (403 OWNER_REQUIRED otherwise).
	purge: (id: string) => Promise<void>;
}

// The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): what was deleted in
// the selected workspace, restorable until each item's `purgeAt`.
export function useDeletedCustomers(client?: CustomersClient): IUseDeletedCustomersReturn {
	const api = useFonderieSubClient(client, (c) => c.customers, 'useDeletedCustomers');
	const q = useScopedQuery(api, '/customers/bin', async (bust) => (await api.listDeletedCustomers({ bust })).result.customers);
	const w = useWrite(() => q.refresh());
	return {
		customers: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		restore: (id) =>
			w.run(async () => {
				await api.restoreCustomer(id);
			}),
		purge: (id) =>
			w.run(async () => {
				await api.purgeDeletedCustomer(id);
			}),
	};
}
