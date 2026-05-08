import type { Middleware } from '@fonderie-js/core';

export function requireAuth(): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		return next();
	}
}
