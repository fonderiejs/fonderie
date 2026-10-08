import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext, Middleware } from '@fonderie/core';

// An archived workspace is READ-ONLY: its data stays readable (so the owner
// can export it), and nothing in it changes until the owner restores it.
//
// withWorkspace puts the answer on every request it resolves, under this key,
// so another brick can honour it BY SHAPE — without depending on this package:
//
//   if (ctx.meta['fonderie.workspaces.archived'] === true) → refuse the write
//
// The brick's own write routes carry requireActiveWorkspace(); an app or a
// brick that depends on @fonderie/workspaces can put it on theirs too.
export const WORKSPACE_ARCHIVED_META_KEY = 'fonderie.workspaces.archived';

/** Is the workspace this request resolved to archived? False when there is none. */
export function isWorkspaceArchived(ctx: IFonderieContext): boolean {
	if (ctx.meta[WORKSPACE_ARCHIVED_META_KEY] === true) return true;
	const archivedAt = (ctx.workspace as { archivedAt?: unknown } | undefined)?.archivedAt;
	return archivedAt !== null && archivedAt !== undefined;
}

/**
 * Refuse a write to an archived workspace with 409 WORKSPACE_ARCHIVED. Runs
 * AFTER withWorkspace. Reads are never gated: put it on writes only. Restore,
 * leaving, and handing the workspace over are what an archived workspace is
 * still for, so they do not carry it.
 */
export function requireActiveWorkspace(): Middleware {
	return async (ctx, next) => {
		if (!ctx.workspace || !isWorkspaceArchived(ctx)) return next();
		return setApiResponse(
			HTTP.CONFLICT,
			'WORKSPACE_ARCHIVED',
			'This workspace is archived and read-only. The owner can restore it.',
		);
	};
}
