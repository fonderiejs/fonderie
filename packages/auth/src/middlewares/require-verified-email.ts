import type { Middleware } from '@fonderie-js/core';

export function requireVerifiedEmail(): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (!ctx.user.emailVerifiedAt) {
			return Response.json({ error: 'Email not verified' }, { status: 403 });
		}

		return next();
	}
}
