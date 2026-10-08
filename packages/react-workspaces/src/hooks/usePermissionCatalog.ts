import type { FonderieApiError, IPermissionCatalogEntryDTO, PermissionOperation, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/react';

export interface IUsePermissionCatalogReturn {
	/** The resources the app checks, with their operations — a role editor's grid. */
	catalog: IPermissionCatalogEntryDTO[];
	/** False when the app declared no catalog. */
	declared: boolean;
	/** What each system role (GUEST, ADMIN…) may do by server config: role → resource → operations. Show these; never hard-code them. */
	systemGrants: Record<string, Record<string, PermissionOperation[]>>;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

const NONE: IPermissionCatalogEntryDTO[] = [];
const NO_GRANTS: Record<string, Record<string, PermissionOperation[]>> = {};

// Build a role editor's switches from this, never from a list in the screen:
// a switch the server never checks tells an owner they restricted something
// they did not.
export function usePermissionCatalog(client?: WorkspacesClient): IUsePermissionCatalogReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'usePermissionCatalog');
	const q = useScopedQuery(
		workspaces,
		'/workspaces/permissions/catalog',
		async (bust) => (await workspaces.getPermissionCatalog({ bust })).result,
		{ perWorkspace: false },
	);
	return {
		catalog: q.data?.catalog ?? NONE,
		declared: q.data?.declared ?? false,
		systemGrants: q.data?.systemGrants ?? NO_GRANTS,
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}
