import type { IStoreAdapter }      from '@fonderie-js/store';

import type { IRoleWithPermissions } from '../types';

export async function getIRoleWithPermissions(
	roleId: string,
	store: IStoreAdapter,
): Promise<IRoleWithPermissions | null> {
	const [role] = await store.query<{
		id: string
		name: string
		workspace_id: string
	}>(
		`SELECT id, name, workspace_id
		FROM fonderie_roles
		WHERE id = $1`,
		[roleId],
	);

	if (!role) {
		return null;
	}

	const perms = await store.query<{ action: string; resource: string }>(
		`SELECT action, resource
		FROM fonderie_role_permissions
		WHERE role_id = $1`,
		[roleId],
	);

	return {
		id:          role.id,
		name:        role.name,
		workspaceId: role.workspace_id,
		permissions: perms,
	}
}

export async function listWorkspaceRoles(
	workspaceId: string,
	store: IStoreAdapter,
): Promise<IRoleWithPermissions[]> {
	const roles = await store.query<{
		id: string
		name: string
		workspace_id: string
	}>(
		`SELECT id, name, workspace_id
		FROM fonderie_roles
		WHERE workspace_id = $1
		ORDER BY name`,
		[workspaceId],
	);

	if (roles.length === 0) {
		return [];
	}

	const roleIds = roles.map(r => r.id)
	const perms   = await store.query<{
		role_id: string
		action:  string
		resource: string
	}>(
		`SELECT role_id, action, resource
		FROM fonderie_role_permissions
		WHERE role_id = ANY($1)`,
		[roleIds],
	);

	return roles.map(role => ({
		id:          role.id,
		name:        role.name,
		workspaceId: role.workspace_id,
		permissions: perms.filter(p => p.role_id === role.id)
			.map(p => ({ action: p.action, resource: p.resource })),
	}));
}
