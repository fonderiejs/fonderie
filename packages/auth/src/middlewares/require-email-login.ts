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

// /auth/mfa/verify does two jobs. Enabling MFA (a signed-in session confirming
// its first code) keeps the email-login requirement. Completing a sign-in that
// is waiting for its second factor does not: a Google or Apple sign-in on an
// account with MFA gets a pending token too, and must be able to finish.
export const requireEmailLoginUnlessSigningIn: Middleware = async (ctx, next) => {
	if (ctx.user!.mfaPending) return next();
	return requireEmailLogin(ctx, next);
};
