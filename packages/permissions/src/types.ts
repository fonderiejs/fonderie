// Canonical definition moved to @fonderie/core; re-exported here for back-compat.
export type { Operation } from '@fonderie/core';
export type PermissionKey = string;

export interface IPermission {
	permissionKey: PermissionKey;
	canCreate: boolean;
	canRead: boolean;
	canUpdate: boolean;
	canDelete: boolean;
}

export interface IRole {
	id: string;
	name: string;
	isSystem: boolean;
	workspaceId: string | null;
}

export interface IRoleWithPermissions extends IRole {
	permissions: IPermission[];
}

export interface IMembership {
	userId: string;
	workspaceId: string;
	roleId: string;
	roleName: string;
}
