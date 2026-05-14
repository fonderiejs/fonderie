import type { IStoreAdapter } from '@fonderie-js/store';

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

export async function getRoleById(id: string, store: IStoreAdapter): Promise<IRole | null> {
	const [row] = await store.query<IRole>(
		`SELECT ${SELECT_ROLE} FROM fonderie_roles WHERE id = $1`,
		[id],
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
	opts: { name?: string; description?: string | null; active?: boolean },
	store: IStoreAdapter,
): Promise<IRole | null> {
	const sets: string[] = [];
	const params: unknown[] = [id];

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

	if (sets.length === 0) return getRoleById(id, store);

	const [row] = await store.query<IRole>(
		`UPDATE fonderie_roles
		 SET ${sets.join(', ')}
		 WHERE id = $1 AND is_system = false
		 RETURNING ${SELECT_ROLE}`,
		params,
	);
	return row ?? null;
}

export async function deleteRole(
	id: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`DELETE FROM fonderie_roles
		 WHERE id = $1 AND workspace_id = $2 AND is_system = false`,
		[id, workspaceId],
	);
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
