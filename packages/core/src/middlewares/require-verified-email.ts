import { setApiResponse, HTTP } from '../response';
import type { Middleware } from '../types';

export const requireVerifiedEmail: Middleware = async (ctx, next) => {
	if (!ctx.user) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
	}
	if (!ctx.user.emailVerifiedAt) {
		return setApiResponse(HTTP.FORBIDDEN, 'EMAIL_NOT_VERIFIED', 'Email address has not been verified');
	}
	return next();
}
