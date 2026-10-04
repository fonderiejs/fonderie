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
): Promise<IRoleDeleteResult | null> {
	return store.transaction(async (tx) => {
		const [role] = await tx.query<{ id: string }>(
			`SELECT id FROM fonderie_roles
			 WHERE id = $1 AND workspace_id = $2 AND is_system = false
			 FOR UPDATE`,
			[id, workspaceId],
		);
		if (!role) return null;

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
	if (permissions.length === 0) {
		await store.query(
			`DELETE FROM fonderie_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
			[roleId, workspaceId],
		);
		return;
	}

	await store.transaction(async (tx) => {
		await tx.query(
			`DELETE FROM fonderie_role_permissions WHERE role_id = $1 AND workspace_id = $2`,
			[roleId, workspaceId],
		);

		for (const p of permissions) {
			await tx.query(
				`INSERT INTO fonderie_role_permissions
				   (role_id, workspace_id, permission_key, can_create, can_read, can_update, can_delete)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
				 ON CONFLICT (role_id, permission_key)
				 DO UPDATE SET
				   can_create = $4, can_read = $5,
				   can_update = $6, can_delete = $7`,
				[roleId, workspaceId, p.permissionKey, p.canCreate, p.canRead, p.canUpdate, p.canDelete],
			);
		}
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
