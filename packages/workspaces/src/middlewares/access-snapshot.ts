import type { IFonderieContext } from '@fonderie/core';

// What withWorkspace already read about the caller's standing in the
// workspace it resolved — for THIS request only. Keyed by the request's own
// context object (a WeakMap: nothing on ctx changes shape, and the entry dies
// with the request), so it can never outlive or cross into another request.
// requireManager reads it to skip a second round-trip for the same facts.
export interface IWorkspaceAccess {
	userId: string;
	workspaceId: string;
	/** Active SYSTEM role names held there (removed/suspended rows excluded). */
	systemRoles: string[];
}

const snapshots = new WeakMap<object, IWorkspaceAccess>();

export function rememberAccess(ctx: IFonderieContext, access: IWorkspaceAccess): void {
	snapshots.set(ctx, access);
}

/** The snapshot, only when it is about this user in this workspace. */
export function accessFor(ctx: IFonderieContext, userId: string, workspaceId: string): IWorkspaceAccess | null {
	const a = snapshots.get(ctx);
	return a && a.userId === userId && a.workspaceId === workspaceId ? a : null;
}
