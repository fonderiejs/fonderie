import type { IFonderieContext, Operation } from '@fonderie/core';

// @fonderie/permissions is optional for this brick (no dependency): its module
// puts its engine on every request under this key. Read by shape, so the role
// editor's catalog and the effective-permissions read work when it is
// installed, and degrade to "no catalog, no grants" when it is not.
const ENGINE_KEY = 'fonderie.permissions.engine';

export interface IPermissionCatalogEntryLike {
	key: string;
	operations?: Operation[];
	label?: string;
	description?: string;
}

export interface IPermissionsEngineLike {
	readonly catalog: readonly IPermissionCatalogEntryLike[] | null;
	/** What each SYSTEM role is granted by config (@fonderie/permissions 5.2+); absent on older versions. */
	readonly systemGrants?: Readonly<Record<string, Readonly<Record<string, readonly Operation[]>>>>;
	isKnown(permissionKey: string): boolean;
	operationsOf(permissionKey: string): Operation[];
	effective(
		userId: string,
		workspaceId: string,
	): Promise<{ isSuper: boolean; permissions: Record<string, Record<Operation, boolean>> } | null>;
}

export function permissionsEngine(ctx: IFonderieContext): IPermissionsEngineLike | null {
	const e = ctx.meta[ENGINE_KEY] as Partial<IPermissionsEngineLike> | undefined;
	// An older @fonderie/permissions has no catalog/effective: treat as absent.
	return e && typeof e.effective === 'function' && typeof e.isKnown === 'function'
		? (e as IPermissionsEngineLike)
		: null;
}
