import { setApiResponse, HTTP } from '../response';
import type { Middleware } from '../types';

export const requireVerified: Middleware = async (ctx, next) => {
	if (!ctx.user) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
	}

	if (ctx.user.loginMethod === 'phone') {
		if (!ctx.user.phoneVerified) {
			return setApiResponse(
				HTTP.FORBIDDEN,
				'PHONE_NOT_VERIFIED',
				'Please verify your phone number',
			);
		}
		return next();
	}

	if (!ctx.user.emailVerifiedAt) {
		return setApiResponse(HTTP.FORBIDDEN, 'EMAIL_NOT_VERIFIED', 'Please verify your email address');
	}

	return next();
};
