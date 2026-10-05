import type { IStoreAdapter } from '@fonderie/store';

import type { IRole } from '../types';

const SELECT_ROLE = `
	id,
	name,
	is_system    AS "isSystem",
	active,
	description,
	workspace_id AS "workspaceId"
`;

export async function createRole(
	opts: { name: string; workspaceId: string; description?: string },
	store: IStoreAdapter,
): Promise<IRole> {
	const [role] = await store.query<IRole>(
		`INSERT INTO fonderie_roles (name, workspace_id, description)
		 VALUES ($1, $2, $3)
		 RETURNING ${SELECT_ROLE}`,
		[opts.name, opts.workspaceId, opts.description ?? null],
	);
	if (!role) throw new Error('Failed to create role');
	return role;
}

export async function findSystemRole(name: string, store: IStoreAdapter): Promise<IRole | null> {
	const [row] = await store.query<IRole>(
		`SELECT ${SELECT_ROLE} FROM fonderie_roles WHERE name = $1 AND is_system = true LIMIT 1`,
		[name],
	);
	return row ?? null;
}

/**
 * Fetch a role by id, scoped to a workspace. A role is visible only when it
 * belongs to the given workspace OR is a (global) system role — otherwise a
 * member of workspace A could read/mutate workspace B's roles by id (IDOR).
 */
export async function getRoleById(
	id: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IRole | null> {
	const [row] = await store.query<IRole>(
		`SELECT ${SELECT_ROLE} FROM fonderie_roles
		 WHERE id = $1 AND (workspace_id = $2 OR is_system = true)`,
		[id, workspaceId],
	);
	return row ?? null;
}

export async function listWorkspaceRoles(
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IRole[]> {
	return store.query<IRole>(
		`SELECT ${SELECT_ROLE}
		 FROM fonderie_roles
		 WHERE workspace_id = $1 OR is_system = true
		 ORDER BY is_system DESC, name ASC`,
		[workspaceId],
	);
}

export async function updateRole(
	id: string,
	workspaceId: string,
	opts: { name?: string; description?: string | null; active?: boolean },
	store: IStoreAdapter,
): Promise<IRole | null> {
	// $1 = id, $2 = workspaceId — the mutation is scoped to the caller's
	// workspace so a member can't rename/deactivate another workspace's role.
	const sets: string[] = [];
	const params: unknown[] = [id, workspaceId];

	if (opts.name !== undefined) {
		params.push(opts.name);
		sets.push(`name = $${params.length}`);
	}
	if (opts.description !== undefined) {
		params.push(opts.description);
		sets.push(`description = $${params.length}`);
	}
	if (opts.active !== undefined) {
		params.push(opts.active);
		sets.push(`active = $${params.length}`);
	}

	if (sets.length === 0) return getRoleById(id, workspaceId, store);

	const [row] = await store.query<IRole>(
		`UPDATE fonderie_roles
		 SET ${sets.join(', ')}
		 WHERE id = $1 AND workspace_id = $2 AND is_system = false
		 RETURNING ${SELECT_ROLE}`,
		params,
	);
	return row ?? null;
}

export interface IRoleDeleteResult {
	/** People who held the role. */
	membersAffected: number;
	/** Of those, the ones it was the only role of — now on the default role. */
	movedToDefaultRole: number;
}

/**
 * Delete a workspace's custom role, with everything hanging off it, in one
 * transaction. An assignment IS a membership, so deleting the assignments of a
 * person whose only role this was would silently remove them from the team;
 * they move to the default (system GUEST) role instead. Before this, only the
 * role row went: assignments and grants were left pointing at nothing.
 * Null when there is no such custom role here.
 */
export async function deleteRole(
	id: string,
	workspaceId: string,
	store: IStoreAdapter,
	deletedBy: string | null = null,
): Promise<IRoleDeleteResult | null> {
	return store.transaction(async (tx) => {
		const [role] = await tx.query<{ id: string }>(
			`SELECT id FROM fonderie_roles
			 WHERE id = $1 AND workspace_id = $2 AND is_system = false
			 FOR UPDATE`,
			[id, workspaceId],
		);
		if (!role) return null;

		// Lock every holder's membership (role row → membership rows, the same
		// order everywhere) BEFORE counting their other roles: a concurrent
		// removal of someone's other role could otherwise leave them, once this
		// role goes too, with no role at all — silently off the team.
		await tx.query(
			`SELECT 1 FROM fonderie_role_user_workspaces
			 WHERE workspace_id = $2 AND removed = false
			   AND user_id IN (SELECT user_id FROM fonderie_role_user_workspaces WHERE role_id = $1 AND workspace_id = $2)
			 ORDER BY user_id, role_id
			 FOR UPDATE`,
			[id, workspaceId],
		);

		const holders = await tx.query<{ userId: string; others: string }>(
			`SELECT ruw.user_id AS "userId",
			        (SELECT COUNT(*) FROM fonderie_role_user_workspaces o
			          WHERE o.user_id = ruw.user_id AND o.workspace_id = ruw.workspace_id
			            AND o.role_id <> ruw.role_id AND o.removed = false) AS others
			 FROM fonderie_role_user_workspaces ruw
			 WHERE ruw.role_id = $1 AND ruw.workspace_id = $2 AND ruw.removed = false`,
			[id, workspaceId],
		);
		const soleHolders = holders.filter((h) => Number(h.others) === 0).map((h) => h.userId);

		if (soleHolders.length > 0) {
			const [guest] = await tx.query<{ id: string }>(
				`SELECT id FROM fonderie_roles
				 WHERE name = 'GUEST' AND workspace_id IS NULL AND is_system = true
				 LIMIT 1`,
			);
			if (!guest) throw new Error('System GUEST role not seeded — run the workspaces migrations');
			await tx.query(
				`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
				 SELECT u, $2, $3, true FROM unnest($1::uuid[]) AS u
				 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE SET removed = false`,
				[soleHolders, workspaceId, guest.id],
			);
		}

		// Into the undo bin, in this transaction: the role, its permissions, who
		// held it, and who moved to the default role because of it.
		await tx.query(
			`INSERT INTO fonderie_role_bin (id, workspace_id, snapshot, deleted_by)
			 SELECT r.id, r.workspace_id, jsonb_build_object(
			   'role', to_jsonb(r),
			   'permissions', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM fonderie_role_permissions p WHERE p.role_id = $1 AND p.workspace_id = $2), '[]'::jsonb),
			   'holders', to_jsonb($3::text[]),
			   'movedToDefault', to_jsonb($4::text[])
			 ), $5
			 FROM fonderie_roles r WHERE r.id = $1
			 ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, deleted_by = EXCLUDED.deleted_by, deleted_at = now()`,
			[id, workspaceId, holders.map((h) => h.userId), soleHolders, deletedBy],
		);

		await tx.query(`DELETE FROM fonderie_role_user_workspaces WHERE role_id = $1 AND workspace_id = $2`, [id, workspaceId]);
		await tx.query(`DELETE FROM fonderie_role_permissions WHERE role_id = $1 AND workspace_id = $2`, [id, workspaceId]);
		await tx.query(`DELETE FROM fonderie_roles WHERE id = $1`, [id]);

		return { membersAffected: holders.length, movedToDefaultRole: soleHolders.length };
	});
}

export async function setRolePermissions(
	roleId: string,
	workspaceId: string,
	permissions: Array<{
		permissionKey: string;
		canCreate: boolean;
		canRead: boolean;
		canUpdate: boolean;
		canDelete: boolean;
	}>,
	store: IStoreAdapter,
): Promise<void> {
	// A SET: the saved permissions become exactly these. The role row is locked
	// first, so two saves run one after the other and the last wins — run side
	// by side, neither DELETE saw the other's rows and the role ended up with
	// the UNION of both (switches nobody chose). The rows go in one INSERT.
	await store.transaction(async (tx) => {
		await tx.query(`SELECT 1 FROM fonderie_roles WHERE id = $1 FOR UPDATE`, [roleId]);
		await tx.query(
			`DELETE FROM fonderie_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
			[roleId, workspaceId],
		);
		if (permissions.length === 0) return;
		await tx.query(
			`INSERT INTO fonderie_role_permissions
			   (role_id, workspace_id, permission_key, can_create, can_read, can_update, can_delete)
			 SELECT $1, $2, p.key, p.c, p.r, p.u, p.d
			 FROM unnest($3::text[], $4::boolean[], $5::boolean[], $6::boolean[], $7::boolean[]) AS p(key, c, r, u, d)
			 ON CONFLICT (role_id, permission_key)
			 DO UPDATE SET
			   can_create = EXCLUDED.can_create, can_read = EXCLUDED.can_read,
			   can_update = EXCLUDED.can_update, can_delete = EXCLUDED.can_delete`,
			[
				roleId,
				workspaceId,
				permissions.map((p) => p.permissionKey),
				permissions.map((p) => p.canCreate),
				permissions.map((p) => p.canRead),
				permissions.map((p) => p.canUpdate),
				permissions.map((p) => p.canDelete),
			],
		);
	});
}

export interface IRolePermission {
	permissionKey: string;
	canCreate: boolean;
	canRead: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}

export async function getRolePermissions(
	roleId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IRolePermission[]> {
	return store.query<IRolePermission>(
		`SELECT permission_key AS "permissionKey",
		        can_create     AS "canCreate",
		        can_read       AS "canRead",
		        can_update     AS "canUpdate",
		        can_delete     AS "canDelete"
		   FROM fonderie_role_permissions
		  WHERE role_id = $1 AND workspace_id = $2
		  ORDER BY permission_key`,
		[roleId, workspaceId],
	);
}

// ── The undo bin (docs/INSIDER-THREAT-DESIGN.md, Phase 3) ─────────────────

/** How long a deleted role stays restorable. */
export const ROLE_BIN_RETENTION_DAYS = 30;

export interface IBinnedRole {
	id: string;
	name: string;
	description: string | null;
	/** How many people held it when it was deleted. */
	holders: number;
	deletedBy: string | null;
	deletedAt: Date;
	purgeAt: Date;
}

export function listRoleBin(store: IStoreAdapter, workspaceId: string, retentionDays = ROLE_BIN_RETENTION_DAYS): Promise<IBinnedRole[]> {
	return store.query<IBinnedRole>(
		`SELECT id, snapshot->'role'->>'name' AS name, snapshot->'role'->>'description' AS description,
		        jsonb_array_length(snapshot->'holders') AS holders,
		        deleted_by AS "deletedBy", deleted_at AS "deletedAt",
		        deleted_at + make_interval(days => $2) AS "purgeAt"
		 FROM fonderie_role_bin
		 WHERE workspace_id = $1 AND deleted_at > now() - make_interval(days => $2)
		 ORDER BY deleted_at DESC`,
		[workspaceId, retentionDays],
	);
}

export type RestoreRoleOutcome =
	| { status: 'restored'; reassigned: number }
	| { status: 'not-in-bin' }
	/** A role with the same name exists now. */
	| { status: 'conflict' };

/**
 * Put a deleted role back, in one transaction: the role with its id, its
 * permissions, and back on everyone who held it AND is still in the team.
 * Whoever was moved to the default role because of the delete leaves it
 * again — they hold the restored role instead, as before.
 */
export async function restoreRole(store: IStoreAdapter, id: string, workspaceId: string, retentionDays = ROLE_BIN_RETENTION_DAYS): Promise<RestoreRoleOutcome> {
	try {
		return await store.transaction(async (tx): Promise<RestoreRoleOutcome> => {
			const [bin] = await tx.query<{ snapshot: { role: unknown; permissions: unknown[]; holders: string[]; movedToDefault: string[] } }>(
				`DELETE FROM fonderie_role_bin
				 WHERE id = $1 AND workspace_id = $2 AND deleted_at > now() - make_interval(days => $3)
				 RETURNING snapshot`,
				[id, workspaceId, retentionDays],
			);
			if (!bin) return { status: 'not-in-bin' };
			const s = bin.snapshot;
			await tx.query(
				`INSERT INTO fonderie_roles SELECT * FROM jsonb_populate_record(NULL::fonderie_roles, $1::jsonb)`,
				[JSON.stringify(s.role)],
			);
			await tx.query(
				`INSERT INTO fonderie_role_permissions SELECT * FROM jsonb_populate_recordset(NULL::fonderie_role_permissions, $1::jsonb)`,
				[JSON.stringify(s.permissions)],
			);
			// Lock the former holders' memberships (the same order as everywhere),
			// then give the role back to those still in the team.
			await tx.query(
				`SELECT 1 FROM fonderie_role_user_workspaces
				 WHERE workspace_id = $2 AND user_id = ANY($1::uuid[]) AND removed = false
				 ORDER BY user_id, role_id FOR UPDATE`,
				[s.holders, workspaceId],
			);
			const back = await tx.query<{ userId: string }>(
				`INSERT INTO fonderie_role_user_workspaces (user_id, workspace_id, role_id, confirmed)
				 SELECT DISTINCT m.user_id, $2::uuid, $3::uuid, true
				 FROM fonderie_role_user_workspaces m
				 WHERE m.workspace_id = $2 AND m.user_id = ANY($1::uuid[]) AND m.removed = false
				 ON CONFLICT (user_id, workspace_id, role_id) DO UPDATE SET removed = false
				 RETURNING user_id AS "userId"`,
				[s.holders, workspaceId, id],
			);
			// The default role they got only because of the delete goes again.
			await tx.query(
				`DELETE FROM fonderie_role_user_workspaces ruw
				 USING fonderie_roles g
				 WHERE g.id = ruw.role_id AND g.name = 'GUEST' AND g.workspace_id IS NULL AND g.is_system = true
				   AND ruw.workspace_id = $2 AND ruw.user_id = ANY($1::uuid[])
				   AND ruw.user_id = ANY($3::uuid[])`,
				[s.movedToDefault, workspaceId, back.map((b) => b.userId)],
			);
			return { status: 'restored', reassigned: back.length };
		});
	} catch (err) {
		if ((err as { code?: string }).code === '23505') return { status: 'conflict' };
		throw err;
	}
}

/** Gone for good — the owner's call. */
export async function purgeRoleFromBin(store: IStoreAdapter, id: string, workspaceId: string): Promise<boolean> {
	const rows = await store.query(`DELETE FROM fonderie_role_bin WHERE id = $1 AND workspace_id = $2 RETURNING id`, [id, workspaceId]);
	return rows.length > 0;
}

/** Empty the bin of roles past the retention — run it from the app's cron. Answers how many went. */
export async function emptyRoleBin(store: IStoreAdapter, options: { olderThanDays?: number } = {}): Promise<number> {
	const rows = await store.query(
		`DELETE FROM fonderie_role_bin WHERE deleted_at <= now() - make_interval(days => $1) RETURNING id`,
		[options.olderThanDays ?? ROLE_BIN_RETENTION_DAYS],
	);
	return rows.length;
}
