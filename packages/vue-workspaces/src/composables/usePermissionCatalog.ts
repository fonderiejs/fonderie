import type { FonderieApiError, IPermissionCatalogEntryDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/vue';
import type { ComputedRef, Ref } from 'vue';
import { computed } from 'vue';

export interface IUsePermissionCatalogReturn {
	/** The resources the app checks, with their operations — a role editor's grid. */
	catalog: ComputedRef<IPermissionCatalogEntryDTO[]>;
	/** False when the app declared no catalog. */
	declared: ComputedRef<boolean>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

const NONE: IPermissionCatalogEntryDTO[] = [];

// Build a role editor's switches from this, never from a list in the screen:
// a switch the server never checks tells an owner they restricted something
// they did not.
export function usePermissionCatalog(client?: WorkspacesClient): IUsePermissionCatalogReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'usePermissionCatalog');
	const q = useScopedQuery(workspaces, '/workspaces/permissions/catalog', async (bust) => (await workspaces.getPermissionCatalog({ bust })).result, {
		perWorkspace: false,
	});
	return {
		catalog: computed(() => q.data.value?.catalog ?? NONE),
		declared: computed(() => q.data.value?.declared ?? false),
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}
