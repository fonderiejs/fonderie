import type { Middleware } from '@fonderie-js/core'

// Ensures ctx.workspace is set — use after workspaceContextMiddleware

export function requireWorkspace(): Middleware {
	return async (ctx, next) => {
		if (!ctx.workspace) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		return next();
	}
}
