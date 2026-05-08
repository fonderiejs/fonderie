import type { IStoreAdapter } from '@fonderie-js/store';

import type { IMembership }    from '../types';

export async function getMembership(
	userId:      string,
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<IMembership | null> {
	const [row] = await store.query<{
		user_id:      string
		workspace_id: string
		role_id:      string
		role_name:    string
	}>(
		`SELECT
		wm.user_id,
		wm.workspace_id,
		wm.role_id,
		r.name AS role_name
		FROM fonderie_workspace_members wm
		JOIN fonderie_roles r ON r.id = wm.role_id
		WHERE wm.user_id      = $1
		AND wm.workspace_id = $2
		AND wm.deleted_at IS NULL`,
		[userId, workspaceId],
	);

	if (!row) {
		return null;
	}

	return {
		userId:      row.user_id,
		workspaceId: row.workspace_id,
		roleId:      row.role_id,
		roleName:    row.role_name,
	}
}
