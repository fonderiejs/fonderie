import type { IStoreAdapter } from '@fonderie/store';

import type { IMembership } from '../types';

export async function getMembership(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IMembership | null> {
	const [row] = await store.query<{
		user_id: string;
		workspace_id: string;
		role_id: string;
		role_name: string;
	}>(
		`SELECT ruw.user_id, ruw.workspace_id, ruw.role_id, r.name AS role_name
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND ruw.removed    = false
		   AND ruw.suspended  = false
		 LIMIT 1`,
		[userId, workspaceId],
	);

	if (!row) return null;

	return {
		userId: row.user_id,
		workspaceId: row.workspace_id,
		roleId: row.role_id,
		roleName: row.role_name,
	};
}

/**
 * Does the user hold the SUPER-ROLE in this workspace? The engine uses this for
 * its total-access bypass, so the match is deliberately restricted to a
 * **system** role: `r.is_system = true`. Without that guard, a member could
 * create a workspace-local role whose name equals the configured super-role
 * (e.g. 'ADMIN') and self-assign it to gain full access — a privilege
 * escalation. System roles are seeded by the app, not member-creatable. Also
 * requires `active = true` so a deactivated role grants nothing.
 */
export async function hasRole(
	userId: string,
	workspaceId: string,
	roleName: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const [row] = await store.query<{ exists: boolean }>(
		`SELECT EXISTS (
		   SELECT 1
		   FROM fonderie_role_user_workspaces ruw
		   JOIN fonderie_roles r ON r.id = ruw.role_id
		   WHERE ruw.user_id      = $1
		     AND ruw.workspace_id = $2
		     AND r.name           = $3
		     AND r.is_system    = true
		     AND r.active       = true
		     AND ruw.removed    = false
		     AND ruw.suspended  = false
		 ) AS exists`,
		[userId, workspaceId, roleName],
	);

	return row?.exists ?? false;
}

/**
 * Does the user hold ANY of the named roles in this workspace (active, not
 * removed/suspended)? Used by requireRole — an EXISTS over ALL of the user's
 * role rows, so a member holding several roles isn't denied because an
 * arbitrary single row (LIMIT 1) happened to be the wrong one. Not restricted
 * to system roles: requireRole checks arbitrary named roles.
 */
export async function hasAnyRole(
	userId: string,
	workspaceId: string,
	roleNames: string[],
	store: IStoreAdapter,
): Promise<boolean> {
	if (roleNames.length === 0) return false;
	const [row] = await store.query<{ exists: boolean }>(
		`SELECT EXISTS (
		   SELECT 1
		   FROM fonderie_role_user_workspaces ruw
		   JOIN fonderie_roles r ON r.id = ruw.role_id
		   WHERE ruw.user_id      = $1
		     AND ruw.workspace_id = $2
		     AND r.name           = ANY($3)
		     AND r.active       = true
		     AND ruw.removed    = false
		     AND ruw.suspended  = false
		 ) AS exists`,
		[userId, workspaceId, roleNames],
	);

	return row?.exists ?? false;
}
