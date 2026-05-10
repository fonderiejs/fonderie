import type { IStoreAdapter }  from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';
import type { IAuthConfig }    from './config';

import { requireAuth, requireVerifiedEmail } from '@fonderie-js/core/middlewares';

import { mfaController }   from './controllers/mfa.controller';
import { authController }  from './controllers/auth.controller';
import { userController }  from './controllers/user.controller';
import { oauthController } from './controllers/oauth.controller';
import { phoneController } from './controllers/phone.controller';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildAuthRoutes(
	store:  IStoreAdapter,
	config: IAuthConfig,
): RouteDefinition[] {
	const user  = userController(store);
	const auth  = authController(store, config);
	const oauth = oauthController(store, config);
	const mfa   = mfaController(store, config, config.google?.clientId ?? 'Fonderie');
	const phone = phoneController(store, config);

	const routes: RouteDefinition[] = [
		// Registration & Login (Public)
		['POST', '/auth/register',                  auth.register],
		['POST', '/auth/login',                     auth.login],

		// Token Management (Public)
		['POST', '/auth/refresh',                   auth.refresh],

		// Email — Password Recovery (Public)
		['POST', '/auth/email/forgot',              auth.forgotPassword],
		['POST', '/auth/email/reset',               auth.resetPassword],

		// Email — Verification (Protected)
		['POST', '/auth/email/verify',              requireAuth, auth.verifyEmail],

		// Account Management (Protected)
		['POST', '/auth/logout',                    requireAuth, auth.logout],
		['POST', '/auth/email/send-verification',   requireAuth, auth.sendVerificationEmail],

		// User Profile (Protected + Verified)
		['GET',    '/users',        requireAuth, requireVerifiedEmail, user.me],
		['PUT',    '/users/update', requireAuth, requireVerifiedEmail, user.updateMe],
		['DELETE', '/users',        requireAuth, requireVerifiedEmail, user.deleteMe],

		// MFA (Protected)
		['POST', '/auth/mfa/setup',   requireAuth, mfa.setup],
		['POST', '/auth/mfa/verify',  requireAuth, mfa.verify],
		['POST', '/auth/mfa/disable', requireAuth, mfa.disable],
	];

	if (config.providers.includes('phone')) {
		routes.push(
			['POST', '/auth/phone/send-verification', requireAuth, phone.sendOtp],
			['POST', '/auth/phone/verify',            requireAuth, phone.verify],
		);
	}

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google',          oauth.googleInit],
			['GET', '/auth/google/callback', oauth.googleCallback],
		);
	}

	return routes;
}
