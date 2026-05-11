import type { IStoreAdapter }  from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';
import type { IAuthConfig }    from './config';

import { requireAuth, requireVerified }  from '@fonderie-js/core/middlewares';
import { requireEmailLogin }             from './middlewares/require-email-login';

import { mfaController }   from './controllers/mfa.controller';
import { authController }  from './controllers/auth.controller';
import { userController }  from './controllers/user.controller';
import { oauthController } from './controllers/oauth.controller';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildAuthRoutes(
	store:  IStoreAdapter,
	config: IAuthConfig,
): RouteDefinition[] {
	const user  = userController(store);
	const auth  = authController(store, config);
	const oauth = oauthController(store, config);
	const mfa   = mfaController(store, config, config.appName ?? 'Fonderie');

	const routes: RouteDefinition[] = [
		// Registration & Login (Public)
		['POST', '/auth/register',                  auth.register],
		['POST', '/auth/login',                     auth.login],

		// Token Management (Public)
		['POST', '/auth/refresh',                   auth.refresh],

		// Email — Password Recovery (Public)
		['POST', '/auth/email/forgot',              auth.forgotPassword],
		['POST', '/auth/email/reset',               auth.resetPassword],

		// Verification (Protected — email or phone, determined by loginMethod)
		['POST', '/auth/verify',             requireAuth, auth.verify],
		['GET',  '/auth/send-verification',  requireAuth, auth.sendVerification],

		// Account Management (Protected)
		['POST', '/auth/logout',              requireAuth, auth.logout],

		// User Profile (Protected; writes also require verified)
		['GET',    '/users',             requireAuth,                  user.me],
		['PUT',    '/users/profile',     requireAuth, requireVerified, user.updateProfile],
		['PUT',    '/users/preferences', requireAuth, requireVerified, user.updatePreferences],
		['PUT',    '/users/email',       requireAuth, requireVerified, user.updateEmail],
		['PUT',    '/users/phone',       requireAuth, requireVerified, user.updatePhone],
		['DELETE', '/users',             requireAuth, requireVerified, user.deleteMe],

		// MFA (email sessions only — OTP is the phone auth factor; email must be verified)
		['POST', '/auth/mfa/setup',         requireAuth, requireEmailLogin, requireVerified, mfa.setup],
		['POST', '/auth/mfa/verify',        requireAuth, requireEmailLogin, requireVerified, mfa.verify],
		['POST', '/auth/mfa/disable',       requireAuth, requireEmailLogin, requireVerified, mfa.disable],
		['POST', '/auth/mfa/backup-codes',  requireAuth, requireEmailLogin, requireVerified, mfa.regenerateBackupCodes],
	];

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google',          oauth.googleInit],
			['GET', '/auth/google/callback', oauth.googleCallback],
		);
	}

	return routes;
}
