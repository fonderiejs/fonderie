import { setApiResponse, HTTP } from '../response';
import type { Middleware } from '../types';

// Requires a fully-authenticated user. Rejects mfaPending tokens — those are
// short-lived pre-auth tokens issued mid-MFA-login and must not grant access
// to any route other than /auth/mfa/verify.
export const requireAuth: Middleware = async (ctx, next) => {
	if (!ctx.user) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
	}
	if (ctx.user.mfaPending) {
		return setApiResponse(HTTP.FORBIDDEN, 'MFA_REQUIRED', 'Complete MFA verification to continue');
	}
	return next();
};

// Accepts both fully-authenticated and mfaPending tokens. Only for routes that
// need to serve both contexts on the same path (e.g. POST /auth/mfa/verify
// handles setup confirmation with a full token and TOTP login with mfaPending).
export const requireAnyAuth: Middleware = async (ctx, next) => {
	if (!ctx.user) {
		return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
	}
	return next();
};
