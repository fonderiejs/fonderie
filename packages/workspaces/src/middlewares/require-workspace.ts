import { setErrorResponse }    from '@fonderie-js/core';
import type { Middleware }      from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';

// Ensures ctx.workspace is set — use after workspaceContextMiddleware

const handler: Middleware = async (ctx, next) => {
	if (!ctx.workspace) {
		return setErrorResponse(400, 'WORKSPACE_REQUIRED', 'Workspace context required');
	}
	return next();
}

export function requireWorkspace(): Middleware
export function requireWorkspace(ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>
export function requireWorkspace(
	ctx?:  IFonderieContext,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	if (ctx !== undefined && next !== undefined) return handler(ctx, next)
	return handler
}
