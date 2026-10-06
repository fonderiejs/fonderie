import type { IStoreAdapter } from '@fonderie/store';

import type { Operation } from '../types';
import { PERMISSION_COLUMN } from '../constants';

export async function checkPermission(
	userId: string,
	workspaceId: string,
	permissionKey: string,
	operation: Operation,
	store: IStoreAdapter,
): Promise<boolean> {
	const col = PERMISSION_COLUMN[operation];

	const [row] = await store.query<{ has_permission: boolean }>(
		`SELECT BOOL_OR(rp.${col}) AS has_permission
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON ruw.role_id = r.id
		 JOIN fonderie_role_permissions rp ON r.id = rp.role_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND rp.workspace_id  = $2
		   AND rp.permission_key = $3
		   AND ruw.removed    = false
		   AND ruw.suspended  = false
		   AND r.active       = true
		   AND (r.workspace_id = $2 OR r.is_system = true)
		 GROUP BY ruw.user_id, ruw.workspace_id`,
		[userId, workspaceId, permissionKey],
	);

	return row?.has_permission ?? false;
}

/**
 * Everything one permission check needs, in ONE round-trip — the same four
 * predicates as getMembership, hasRole (super-role), listSystemRoleNames and
 * checkPermission, each written exactly as there, read side by side:
 *
 *   member      — an active row joined to an existing role (getMembership)
 *   isSuper     — holds the super-role as an ACTIVE SYSTEM role (hasRole)
 *   systemRoles — the active SYSTEM roles held (listSystemRoleNames)
 *   granted     — a stored grant for `operation` on `permissionKey` (checkPermission)
 *
 * The caller applies the same order of decisions the engine always has.
 */
export async function readAccess(
	userId: string,
	workspaceId: string,
	permissionKey: string,
	operation: Operation,
	superRole: string,
	store: IStoreAdapter,
): Promise<{ member: boolean; isSuper: boolean; systemRoles: string[]; granted: boolean }> {
	const col = PERMISSION_COLUMN[operation];
	const [row] = await store.query<{ member: boolean; is_super: boolean; system_roles: string[] | null; granted: boolean | null }>(
		`SELECT
		   EXISTS (
		     SELECT 1
		     FROM fonderie_role_user_workspaces ruw
		     JOIN fonderie_roles r ON r.id = ruw.role_id
		     WHERE ruw.user_id      = $1
		       AND ruw.workspace_id = $2
		       AND ruw.removed    = false
		       AND ruw.suspended  = false
		   ) AS member,
		   EXISTS (
		     SELECT 1
		     FROM fonderie_role_user_workspaces ruw
		     JOIN fonderie_roles r ON r.id = ruw.role_id
		     WHERE ruw.user_id      = $1
		       AND ruw.workspace_id = $2
		       AND r.name           = $4
		       AND r.is_system    = true
		       AND r.active       = true
		       AND ruw.removed    = false
		       AND ruw.suspended  = false
		   ) AS is_super,
		   ARRAY (
		     SELECT DISTINCT r.name
		     FROM fonderie_role_user_workspaces ruw
		     JOIN fonderie_roles r ON r.id = ruw.role_id
		     WHERE ruw.user_id      = $1
		       AND ruw.workspace_id = $2
		       AND r.is_system    = true
		       AND r.active       = true
		       AND ruw.removed    = false
		       AND ruw.suspended  = false
		   ) AS system_roles,
		   (
		     SELECT BOOL_OR(rp.${col})
		     FROM fonderie_role_user_workspaces ruw
		     JOIN fonderie_roles r ON ruw.role_id = r.id
		     JOIN fonderie_role_permissions rp ON r.id = rp.role_id
		     WHERE ruw.user_id      = $1
		       AND ruw.workspace_id = $2
		       AND rp.workspace_id  = $2
		       AND rp.permission_key = $3
		       AND ruw.removed    = false
		       AND ruw.suspended  = false
		       AND r.active       = true
		       AND (r.workspace_id = $2 OR r.is_system = true)
		   ) AS granted`,
		[userId, workspaceId, permissionKey, superRole],
	);
	return {
		member: row?.member === true,
		isSuper: row?.is_super === true,
		systemRoles: row?.system_roles ?? [],
		granted: row?.granted === true,
	};
}

/**
 * Every grant the member's STORED roles give in this workspace, folded across
 * roles (a member with two roles gets the union) — one query for the
 * effective-permissions read instead of one check per key.
 */
export async function listGrantedPermissions(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<Array<{ permissionKey: string; create: boolean; read: boolean; update: boolean; delete: boolean }>> {
	return store.query(
		`SELECT rp.permission_key   AS "permissionKey",
		        BOOL_OR(rp.can_create) AS "create",
		        BOOL_OR(rp.can_read)   AS "read",
		        BOOL_OR(rp.can_update) AS "update",
		        BOOL_OR(rp.can_delete) AS "delete"
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON ruw.role_id = r.id
		 JOIN fonderie_role_permissions rp ON r.id = rp.role_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND rp.workspace_id  = $2
		   AND ruw.removed    = false
		   AND ruw.suspended  = false
		   AND r.active       = true
		   AND (r.workspace_id = $2 OR r.is_system = true)
		 GROUP BY rp.permission_key`,
		[userId, workspaceId],
	);
}
