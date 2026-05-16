import type { IStoreAdapter } from '@fonderie-js/store';

import type { IMember, IRole } from '../types';

const SELECT_MEMBER = `
	ruw.user_id      AS "userId",
	ruw.workspace_id AS "workspaceId",
	ruw.role_id      AS "roleId",
	r.name           AS "roleName",
	ruw.confirmed    AS "confirmed",
	ruw.created_at   AS "createdAt"
`;

export async function getMember(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IMember | null> {
	const [row] = await store.query<IMember>(
		`SELECT ${SELECT_MEMBER}
		 FROM fonderie_role_user_workspaces ruw
		 LEFT JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND ruw.removed      = false
		   AND ruw.suspended    = false
		 LIMIT 1`,
		[userId, workspaceId],
	);
	return row ?? null;
}

export async function listMembers(workspaceId: string, store: IStoreAdapter): Promise<IMember[]> {
	return store.query<IMember>(
		`SELECT ${SELECT_MEMBER}
		 FROM fonderie_role_user_workspaces ruw
		 LEFT JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.workspace_id = $1
		   AND ruw.removed      = false
		   AND ruw.suspended    = false
		 ORDER BY ruw.created_at ASC`,
		[workspaceId],
	);
}

export async function addMember(
	opts: { userId: string; workspaceId: string; roleId: string; confirmed?: boolean },
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
		 SET confirmed = $4, removed = false, suspended = false`,
		[opts.userId, opts.workspaceId, opts.roleId, opts.confirmed ?? true],
	);
}

export async function removeMember(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`UPDATE fonderie_role_user_workspaces
		 SET removed = true
		 WHERE user_id      = $1
		   AND workspace_id = $2`,
		[userId, workspaceId],
	);
}

export async function getUserRoles(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IRole[]> {
	return store.query<IRole>(
		`SELECT
		   r.id,
		   r.name,
		   r.is_system    AS "isSystem",
		   r.active,
		   r.description,
		   r.workspace_id AS "workspaceId"
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND ruw.removed      = false
		   AND ruw.suspended    = false`,
		[userId, workspaceId],
	);
}

export async function addRoleToMember(
	userId: string,
	workspaceId: string,
	roleId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
		 VALUES ($1, $2, $3, true)
		 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
		 SET confirmed = true, removed = false, suspended = false`,
		[userId, workspaceId, roleId],
	);
}

export async function removeRoleFromMember(
	userId: string,
	workspaceId: string,
	roleId: string,
	store: IStoreAdapter,
): Promise<void> {
	const remaining = await store.query<{ count: string }>(
		`SELECT COUNT(*) AS count
		 FROM fonderie_role_user_workspaces
		 WHERE user_id      = $1
		   AND workspace_id = $2
		   AND removed      = false`,
		[userId, workspaceId],
	);
	const count = parseInt(remaining[0]?.count ?? '0', 10);
	if (count <= 1) throw new Error('Cannot remove last role from member');

	await store.query(
		`DELETE FROM fonderie_role_user_workspaces
		 WHERE user_id      = $1
		   AND workspace_id = $2
		   AND role_id      = $3`,
		[userId, workspaceId, roleId],
	);
}
