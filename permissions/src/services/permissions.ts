import type { IStoreAdapter } from '@fonderie-js/store';

import type { IPermission }    from '../types';

export async function getPermissionsForUser(
	userId:      string,
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<IPermission[]> {
	const rows = await store.query<{ action: string; resource: string }>(
		`SELECT DISTINCT rp.action, rp.resource
		FROM fonderie_role_permissions rp
		JOIN fonderie_workspace_members wm ON wm.role_id = rp.role_id
		WHERE wm.user_id      = $1
		AND wm.workspace_id = $2
		AND wm.deleted_at IS NULL`,
		[userId, workspaceId],
	)

	return rows
}
