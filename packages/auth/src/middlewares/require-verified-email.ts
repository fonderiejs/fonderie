import { setErrorResponse }  from '@fonderie-js/core';
import type { Middleware }    from '@fonderie-js/core';

export function requireVerifiedEmail(): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		if (!ctx.user.emailVerifiedAt) {
			return setErrorResponse('EMAIL_NOT_VERIFIED', 'Email address has not been verified', 403);
		}

		return next();
	}
}
