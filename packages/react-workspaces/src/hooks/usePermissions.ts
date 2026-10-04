import type { FonderieApiError, IMyPermissionsResult, PermissionOperation, WorkspacesClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUsePermissionsReturn {
	/** May this member do `operation` on `resource` here? False until known. */
	can: (operation: PermissionOperation, resource: string) => boolean;
	isOwner: boolean;
	/** The owner or a manager: may run the team (members, invitations, roles, settings). */
	isManager: boolean;
	permissions: IMyPermissionsResult['permissions'];
	/** Nothing known yet — `can` answers false meanwhile. */
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

const NONE: IMyPermissionsResult['permissions'] = {};

// What the signed-in member may do in the SELECTED workspace — read once,
// shared by every screen, re-read on a workspace switch and after any
// workspace write (a role change). Use it to show only the actions that will
// succeed; still handle a 403, since rights can change while a screen is open.
// Until the answer is known, `can` says no: a button that appears late is
// better than one that appears and then dead-ends.
export function usePermissions(client?: WorkspacesClient): IUsePermissionsReturn {
	const workspaces = useFonderieSubClient(client, (c) => c.workspaces, 'usePermissions');
	const q = useScopedQuery(
		workspaces,
		'/workspaces/current/permissions',
		async (bust) => (await workspaces.getMyPermissions({ bust })).result,
	);
	const data = q.data;
	const can = useCallback(
		(operation: PermissionOperation, resource: string) =>
			!!data && (data.isSuper || data.permissions[resource]?.[operation] === true),
		[data],
	);
	return {
		can,
		isOwner: data?.isOwner ?? false,
		isManager: data?.isManager ?? false,
		permissions: data?.permissions ?? NONE,
		isLoading: q.isLoading,
		error: q.error,
		refresh: q.refresh,
	};
}

/** `usePermissions().can(operation, resource)` for a single check. */
export function useCan(operation: PermissionOperation, resource: string, client?: WorkspacesClient): boolean {
	return usePermissions(client).can(operation, resource);
}
