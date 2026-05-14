import type { IStoreAdapter } from '@fonderie-js/store';

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
		     AND ruw.removed    = false
		     AND ruw.suspended  = false
		 ) AS exists`,
		[userId, workspaceId, roleName],
	);

	return row?.exists ?? false;
}
