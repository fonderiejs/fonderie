import type { IStoreAdapter } from '@fonderie-js/store';

import type { Operation }    from '../types';
import { PERMISSION_COLUMN } from '../constants';

export async function checkPermission(
	userId:        string,
	workspaceId:   string,
	permissionKey: string,
	operation:     Operation,
	store:         IStoreAdapter,
): Promise<boolean> {
	const col = PERMISSION_COLUMN[operation]

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
		   AND (r.workspace_id = $2 OR r.is_system = true)
		 GROUP BY ruw.user_id, ruw.workspace_id`,
		[userId, workspaceId, permissionKey],
	)

	return row?.has_permission ?? false
}
