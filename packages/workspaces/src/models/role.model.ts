import type { IStoreAdapter } from '@fonderie-js/store';

import type { IRole } from '../types';
import {
	createRole,
	findSystemRole,
	getRoleById,
	listWorkspaceRoles,
	updateRole,
	deleteRole,
	setRolePermissions,
} from '../services/roles';

export class RoleModel {
	constructor(private readonly store: IStoreAdapter) {}

	create(opts: Parameters<typeof createRole>[0]): Promise<IRole> {
		return createRole(opts, this.store);
	}

	findSystem(name: string): Promise<IRole | null> {
		return findSystemRole(name, this.store);
	}

	findById(id: string): Promise<IRole | null> {
		return getRoleById(id, this.store);
	}

	list(workspaceId: string): Promise<IRole[]> {
		return listWorkspaceRoles(workspaceId, this.store);
	}

	update(id: string, opts: Parameters<typeof updateRole>[1]): Promise<IRole | null> {
		return updateRole(id, opts, this.store);
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
}
