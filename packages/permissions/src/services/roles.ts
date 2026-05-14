import type { IStoreAdapter } from '@fonderie-js/store';

import type { IRoleWithPermissions } from '../types';

type RoleRow = {
	id: string;
	name: string;
	is_system: boolean;
	workspace_id: string | null;
};

type PermRow = {
	role_id: string;
	permission_key: string;
	can_create: boolean;
	can_read: boolean;
	can_update: boolean;
	can_delete: boolean;
};

function mapPerms(perms: PermRow[], roleId: string) {
	return perms
		.filter((p) => p.role_id === roleId)
		.map((p) => ({
			permissionKey: p.permission_key,
			canCreate: p.can_create,
			canRead: p.can_read,
			canUpdate: p.can_update,
			canDelete: p.can_delete,
		}));
}

export async function getRoleWithPermissions(
	roleId: string,
	store: IStoreAdapter,
): Promise<IRoleWithPermissions | null> {
	const [role] = await store.query<RoleRow>(
		`SELECT id, name, is_system, workspace_id
		 FROM fonderie_roles WHERE id = $1`,
		[roleId],
	);

	if (!role) return null;

	const perms = await store.query<Omit<PermRow, 'role_id'> & { role_id: string }>(
		`SELECT role_id, permission_key, can_create, can_read, can_update, can_delete
		 FROM fonderie_role_permissions WHERE role_id = $1`,
		[roleId],
	);

	return {
		id: role.id,
		name: role.name,
		isSystem: role.is_system,
		workspaceId: role.workspace_id,
		permissions: mapPerms(perms, roleId),
	};
}

export async function listWorkspaceRoles(
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IRoleWithPermissions[]> {
	const roles = await store.query<RoleRow>(
		`SELECT id, name, is_system, workspace_id
		 FROM fonderie_roles
		 WHERE workspace_id = $1 OR is_system = true
		 ORDER BY name`,
		[workspaceId],
	);

	if (roles.length === 0) return [];

	const roleIds = roles.map((r) => r.id);
	const perms = await store.query<PermRow>(
		`SELECT role_id, permission_key, can_create, can_read, can_update, can_delete
		 FROM fonderie_role_permissions
		 WHERE role_id = ANY($1)`,
		[roleIds],
	);

	return roles.map((role) => ({
		id: role.id,
		name: role.name,
		isSystem: role.is_system,
		workspaceId: role.workspace_id,
		permissions: mapPerms(perms, role.id),
	}));
}
