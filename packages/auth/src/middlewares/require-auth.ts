import { setErrorResponse }  from '@fonderie-js/core';
import type { Middleware }    from '@fonderie-js/core';

export function requireAuth(): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		return next();
	}
}
