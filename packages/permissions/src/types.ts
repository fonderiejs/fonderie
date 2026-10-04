import type { Operation } from '@fonderie/core';

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

export interface IPermissionCatalogEntry {
	/** The resource key requirePermission checks, e.g. 'jobs'. */
	key: string;
	/** The operations that mean something for it. Default: all four. */
	operations?: Operation[];
	/** Shown by a role editor; the key when unset. */
	label?: string;
	description?: string;
}

/** What one member may do in one workspace. */
export interface IEffectivePermissions {
	/** Holds the super role: everything is allowed, catalog or not. */
	isSuper: boolean;
	/** Per resource, per operation. Missing = not allowed. */
	permissions: Record<string, Record<Operation, boolean>>;
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
