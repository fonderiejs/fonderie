import type { FonderieApiError, IDeletedRoleDTO, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseDeletedRolesReturn {
	roles: IDeletedRoleDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Back where it was, with the same id.
	restore: (id: string) => Promise<void>;
	// Gone for good — the workspace owner only (403 OWNER_REQUIRED otherwise).
	purge: (id: string) => Promise<void>;
}

const NONE: IDeletedRoleDTO[] = [];

// The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3): what was deleted in
// the selected workspace, restorable until each item's `purgeAt`.
export function useDeletedRoles(client?: WorkspacesClient): IUseDeletedRolesReturn {
	const api = useFonderieSubClient(client, (c) => c.workspaces, 'useDeletedRoles');
	const q = useScopedQuery(api, '/workspaces/roles/bin', async (bust) => (await api.listDeletedRoles({ bust })).result.roles);
	const w = useWrite(q.refresh);
	const restore = useCallback(
		(id: string) =>
			w.run(async () => {
				await api.restoreRole(id);
			}),
		[api, w.run],
	);
	const purge = useCallback(
		(id: string) =>
			w.run(async () => {
				await api.purgeDeletedRole(id);
			}),
		[api, w.run],
	);
	return { roles: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, restore, purge };
}
