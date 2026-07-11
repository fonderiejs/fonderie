import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';

// Ensures ctx.workspace is set — use after withWorkspace

export const requireWorkspace: Middleware = async (ctx, next) => {
	if (!ctx.workspace) {
		return setApiResponse(HTTP.BAD_REQUEST, 'WORKSPACE_REQUIRED', 'Workspace context required');
	}
	return next();
};
