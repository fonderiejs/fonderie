import type { IStoreAdapter } from '@fonderie/store';

import type { IRole } from '../types';
import {
	createRole,
	findSystemRole,
	getRoleById,
	listWorkspaceRoles,
	updateRole,
	deleteRole,
	setRolePermissions,
	getRolePermissions,
} from '../services/roles';

export class RoleModel {
	constructor(private readonly store: IStoreAdapter) {}

	create(opts: Parameters<typeof createRole>[0]): Promise<IRole> {
		return createRole(opts, this.store);
	}

	findSystem(name: string): Promise<IRole | null> {
		return findSystemRole(name, this.store);
	}

	findById(id: string, workspaceId: string): Promise<IRole | null> {
		return getRoleById(id, workspaceId, this.store);
	}

	list(workspaceId: string): Promise<IRole[]> {
		return listWorkspaceRoles(workspaceId, this.store);
	}

	update(
		id: string,
		workspaceId: string,
		opts: Parameters<typeof updateRole>[2],
	): Promise<IRole | null> {
		return updateRole(id, workspaceId, opts, this.store);
	}

	delete(id: string, workspaceId: string): Promise<void> {
		return deleteRole(id, workspaceId, this.store);
	}

	setPermissions(
		roleId: string,
		workspaceId: string,
		permissions: Parameters<typeof setRolePermissions>[2],
	): Promise<void> {
		return setRolePermissions(roleId, workspaceId, permissions, this.store);
	}

	getPermissions(roleId: string, workspaceId: string): ReturnType<typeof getRolePermissions> {
		return getRolePermissions(roleId, workspaceId, this.store);
	}
}
