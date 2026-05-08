import type { IStoreAdapter } from '@fonderie-js/store';

import type { IMember }        from '../types';

export async function getMember(
	userId:      string,
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<IMember | null> {
	const [row] = await store.query<IMember>(
		`SELECT
			wm.id,
			wm.user_id      AS "userId",
			wm.workspace_id AS "workspaceId",
			wm.role_id      AS "roleId",
			r.name          AS "roleName",
			wm.created_at   AS "createdAt"
		FROM fonderie_workspace_members wm
		JOIN fonderie_roles r ON r.id = wm.role_id
		WHERE wm.user_id      = $1
			AND wm.workspace_id = $2
			AND wm.deleted_at   IS NULL`,
		[userId, workspaceId],
	);

	return row ?? null
}

export async function listMembers(
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<IMember[]> {
	return store.query<IMember>(
		`SELECT
			wm.id,
			wm.user_id      AS "userId",
			wm.workspace_id AS "workspaceId",
			wm.role_id      AS "roleId",
			r.name          AS "roleName",
			wm.created_at   AS "createdAt"
		FROM fonderie_workspace_members wm
		JOIN fonderie_roles r ON r.id = wm.role_id
		WHERE wm.workspace_id = $1
			AND wm.deleted_at   IS NULL
			ORDER BY wm.created_at ASC`,
		[workspaceId],
	);
}

export async function addMember(
	opts: { userId: string; workspaceId: string; roleId: string },
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_workspace_members (user_id, workspace_id, role_id)
			VALUES ($1, $2, $3)
		ON CONFLICT (user_id, workspace_id) WHERE deleted_at IS NULL
			DO NOTHING`,
		[opts.userId, opts.workspaceId, opts.roleId],
	);
}

export async function removeMember(
	userId:      string,
	workspaceId: string,
	store:       IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_workspace_members
			SET deleted_at = now()
		WHERE user_id      = $1
			AND workspace_id = $2
			AND deleted_at   IS NULL`,
		[userId, workspaceId],
	);
}
