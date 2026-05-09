import { setErrorResponse }  from '@fonderie-js/core';
import type { Middleware }    from '@fonderie-js/core';

// Ensures ctx.workspace is set — use after workspaceContextMiddleware

export function requireWorkspace(): Middleware {
	return async (ctx, next) => {
		if (!ctx.workspace) {
			return setErrorResponse(400, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		return next();
	}
}
