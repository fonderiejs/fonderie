import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';

// Gate for OWNERSHIP decisions — who manages the team, and who owns it. A
// manager can run the team (invite, remove, assign custom roles) but cannot
// create other managers or take the workspace: otherwise any manager could
// out-vote the owner by promoting allies. Runs AFTER withWorkspace.
export function requireOwner(): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		if (!ctx.workspace) return next();
		const ownerId = (ctx.workspace as { ownerId?: string }).ownerId;
		if (ownerId !== ctx.user.id) {
			return setApiResponse(HTTP.FORBIDDEN, 'OWNER_REQUIRED', 'Only the workspace owner can do this');
		}
		return next();
	};
}
