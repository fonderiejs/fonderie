import type { IStoreAdapter } from '@fonderie/store';

import type { IMember, IRole } from '../types';

const SELECT_MEMBER = `
	ruw.user_id           AS "userId",
	ruw.workspace_id      AS "workspaceId",
	ruw.role_id           AS "roleId",
	r.name                AS "roleName",
	ruw.confirmed         AS "confirmed",
	ruw.created_at        AS "createdAt",
	u.first_name          AS "firstName",
	u.last_name           AS "lastName",
	u.email               AS "email",
	u.profile_image_url   AS "profileImageUrl"
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
		 LEFT JOIN fonderie_users u ON u.id = ruw.user_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND ruw.removed      = false
		   AND ruw.suspended    = false
		 LIMIT 1`,
		[userId, workspaceId],
	);
	return row ?? null;
}

/**
 * One row per PERSON, with every role they hold in `roles` (earliest first).
 *
 * Memberships are stored one row per (user, role), so a plain join returns a
 * person once per role — duplicate list entries, and a "the member's role"
 * that depends on which row came first. Grouping here means no client ever has
 * to. `roleId` / `roleName` stay populated (the earliest role) for callers
 * written against the one-row-per-role shape.
 *
 * `managerRoles` are the system-role names that count as managers — the same
 * list requireManager enforces (default ['ADMIN']).
 */
export async function listMembers(
	workspaceId: string,
	store: IStoreAdapter,
	managerRoles: string[] = ['ADMIN'],
): Promise<IMember[]> {
	return store.query<IMember>(
		`SELECT
		   ruw.user_id                                   AS "userId",
		   ruw.workspace_id                              AS "workspaceId",
		   (array_agg(ruw.role_id ORDER BY ruw.created_at, r.name))[1] AS "roleId",
		   (array_agg(r.name ORDER BY ruw.created_at, r.name))[1]      AS "roleName",
		   bool_or(ruw.confirmed)                        AS "confirmed",
		   min(ruw.created_at)                           AS "createdAt",
		   u.first_name                                  AS "firstName",
		   u.last_name                                   AS "lastName",
		   u.email                                       AS "email",
		   u.profile_image_url                           AS "profileImageUrl",
		   COALESCE(
		     json_agg(json_build_object('id', r.id, 'name', r.name, 'isSystem', r.is_system)
		              ORDER BY ruw.created_at, r.name)
		       FILTER (WHERE r.id IS NOT NULL),
		     '[]'::json
		   )                                             AS "roles",
		   (w.owner_id = ruw.user_id)                    AS "isOwner",
		   (w.owner_id = ruw.user_id
		     OR bool_or(r.is_system AND r.active AND r.name = ANY($2)))  AS "isManager"
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_workspaces w ON w.id = ruw.workspace_id
		 LEFT JOIN fonderie_roles r ON r.id = ruw.role_id
		 LEFT JOIN fonderie_users u ON u.id = ruw.user_id
		 WHERE ruw.workspace_id = $1
		   AND ruw.removed      = false
		   AND ruw.suspended    = false
		   -- A deleted account (archived for its grace period, or already purged)
		   -- is not on the team: no name / email / photo shown, no seat taken.
		   -- Restoring the account brings the membership back.
		   AND u.id IS NOT NULL AND u.deleted_at IS NULL
		 GROUP BY ruw.user_id, ruw.workspace_id, w.owner_id,
		          u.first_name, u.last_name, u.email, u.profile_image_url
		 ORDER BY min(ruw.created_at) ASC`,
		[workspaceId, managerRoles],
	);
}

/**
 * Seats a workspace occupies against a plan's limit: each PERSON once (a
 * member with three roles is one seat), the owner never (the owner is the
 * subscriber, not a seat), plus every pending, unexpired invitation to someone
 * who is not already a member — an invitation reserves its seat, so a team
 * cannot invite past its limit across several requests and have every invite
 * accepted.
 */
export async function countOccupiedSeats(workspaceId: string, store: IStoreAdapter): Promise<number> {
	const [row] = await store.query<{ seats: string }>(
		`WITH members AS (
		   SELECT DISTINCT ruw.user_id, lower(u.email) AS email
		   FROM fonderie_role_user_workspaces ruw
		   JOIN fonderie_workspaces w ON w.id = ruw.workspace_id
		   LEFT JOIN fonderie_users u ON u.id = ruw.user_id
		   WHERE ruw.workspace_id = $1
		     AND ruw.removed      = false
		     AND ruw.suspended    = false
		     AND u.id IS NOT NULL AND u.deleted_at IS NULL
		     AND (w.is_personal OR ruw.user_id <> w.owner_id)
		 ), owner AS (
		   SELECT lower(u.email) AS email
		   FROM fonderie_workspaces w JOIN fonderie_users u ON u.id = w.owner_id
		   WHERE w.id = $1
		 )
		 SELECT (SELECT COUNT(*) FROM members)
		      + (SELECT COUNT(DISTINCT lower(i.email))
		         FROM fonderie_workspace_invitations i
		         WHERE i.workspace_id = $1
		           AND i.status       = 'PENDING'
		           AND i.expires_at   > now()
		           AND lower(i.email) NOT IN (SELECT email FROM members WHERE email IS NOT NULL)
		           AND lower(i.email) NOT IN (SELECT email FROM owner WHERE email IS NOT NULL)
		        ) AS seats`,
		[workspaceId],
	);
	return parseInt(row?.seats ?? '0', 10);
}

/**
 * Grant or revoke a manager system role for an existing member. Only the
 * owner may call this (the route guards it): managers run the team, so making
 * one is an ownership decision. Returns false when the user is not a member.
 */
export async function setManager(
	userId: string,
	workspaceId: string,
	manager: boolean,
	store: IStoreAdapter,
	managerRole = 'ADMIN',
): Promise<boolean> {
	if (!(await getMember(userId, workspaceId, store))) return false;
	if (manager) {
		await store.query(
			`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
			 SELECT $1, $2, r.id, true
			 FROM fonderie_roles r
			 WHERE r.name = $3 AND r.is_system = true AND r.workspace_id IS NULL
			 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
			 SET confirmed = true, removed = false, suspended = false`,
			[userId, workspaceId, managerRole],
		);
		return true;
	}
	// Revoking must not leave the person with no role at all (they would drop
	// out of the member list while still being a member): keep them on the
	// least-privilege default when the manager role was their only one.
	await store.transaction(async (tx) => {
		await tx.query(
			`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
			 SELECT $1, $2, g.id, true
			 FROM fonderie_roles g
			 WHERE g.name = 'GUEST' AND g.is_system = true AND g.workspace_id IS NULL
			   AND NOT EXISTS (
			     SELECT 1 FROM fonderie_role_user_workspaces o
			     JOIN fonderie_roles r ON r.id = o.role_id
			     WHERE o.user_id = $1 AND o.workspace_id = $2 AND o.removed = false
			       AND NOT (r.is_system AND r.name = $3)
			   )
			 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE SET removed = false`,
			[userId, workspaceId, managerRole],
		);
		await tx.query(
			`DELETE FROM fonderie_role_user_workspaces ruw
			 USING fonderie_roles r
			 WHERE r.id = ruw.role_id
			   AND ruw.user_id = $1 AND ruw.workspace_id = $2
			   AND r.is_system = true AND r.name = $3`,
			[userId, workspaceId, managerRole],
		);
	});
	return true;
}

/**
 * Hand the workspace to another member. The new owner must already be a
 * member; the previous owner stays, as a manager, so the hand-over never locks
 * them out of a team they still work in. Returns false when the target is not
 * a member.
 */
export async function transferOwnership(
	workspaceId: string,
	fromUserId: string,
	toUserId: string,
	store: IStoreAdapter,
	managerRole = 'ADMIN',
): Promise<boolean> {
	if (!(await getMember(toUserId, workspaceId, store))) return false;
	await store.transaction(async (tx) => {
		await tx.query(
			`UPDATE fonderie_workspaces SET owner_id = $2, updated_at = now()
			 WHERE id = $1 AND owner_id = $3`,
			[workspaceId, toUserId, fromUserId],
		);
		await tx.query(
			`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
			 SELECT $1, $2, r.id, true
			 FROM fonderie_roles r
			 WHERE r.name = $3 AND r.is_system = true AND r.workspace_id IS NULL
			 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
			 SET confirmed = true, removed = false, suspended = false`,
			[fromUserId, workspaceId, managerRole],
		);
	});
	return true;
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

/**
 * Assign an existing role to a member via the HTTP surface. Returns false when
 * the role is not assignable — the insert only proceeds for a role that belongs
 * to THIS workspace and is NOT a system role. This is the privilege-escalation
 * guard: system roles carry the super-role bypass (@fonderie/permissions), so a
 * member must never be able to self-grant one (e.g. the seeded ADMIN role) to
 * gain full access; cross-workspace role ids must not be assignable either.
 * Seeding of system/owner roles at workspace-creation / invitation time goes
 * through addMember(), not this path, so that flow is unaffected.
 */
export async function addRoleToMember(
	userId: string,
	workspaceId: string,
	roleId: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ user_id: string }>(
		`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
		 SELECT $1, $2, $3, true
		 WHERE EXISTS (
		   SELECT 1 FROM fonderie_roles r
		   WHERE r.id = $3
		     AND r.workspace_id = $2
		     AND r.is_system = false
		 )
		 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE
		 SET confirmed = true, removed = false, suspended = false
		 RETURNING user_id`,
		[userId, workspaceId, roleId],
	);
	return rows.length > 0;
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
