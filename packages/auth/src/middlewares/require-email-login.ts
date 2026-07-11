import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';

export const requireEmailLogin: Middleware = async (ctx, next) => {
	if (ctx.user!.loginMethod !== 'email') {
		return setApiResponse(
			HTTP.FORBIDDEN,
			'EMAIL_LOGIN_REQUIRED',
			'This action requires email authentication',
		);
	}
	return next();
};
