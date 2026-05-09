import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import { authController }  from './controllers/auth.controller';
import { userController }  from './controllers/user.controller';
import { mfaController }   from './controllers/mfa.controller';
import { oauthController } from './controllers/oauth.controller';
import middlewares          from './middlewares';
import type { IAuthConfig } from './config';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildAuthRoutes(
	store:  IStoreAdapter,
	config: IAuthConfig,
): RouteDefinition[] {
	const auth  = authController(store, config);
	const user  = userController(store);
	const mfa   = mfaController(store, config, config.google?.clientId ?? 'Fonderie');
	const oauth = oauthController(store, config);

	const routes: RouteDefinition[] = [
		// Registration & Login (Public)
		['POST', '/auth/register',                  auth.register],
		['POST', '/auth/login',                     auth.login],

		// Token Management (Public)
		['POST', '/auth/refresh-tokens',            auth.refresh],

		// Password Recovery (Public)
		['POST', '/auth/forgot-password',           auth.forgotPassword],
		['POST', '/auth/reset-password',            auth.resetPassword],

		// Email Verification (Public)
		['POST', '/auth/verify-email',              auth.verifyEmail],

		// Account Management (Protected)
		['POST', '/auth/logout',                    middlewares.requireAuth, auth.logout],
		['POST', '/auth/send-verification-email',   middlewares.requireAuth, auth.sendVerificationEmail],

		// User Profile (Protected + Verified)
		['GET',    '/users',        middlewares.requireAuth, middlewares.requireVerifiedEmail, user.me],
		['PUT',    '/users/update', middlewares.requireAuth, middlewares.requireVerifiedEmail, user.updateMe],
		['DELETE', '/users',        middlewares.requireAuth, middlewares.requireVerifiedEmail, user.deleteMe],

		// MFA (Protected)
		['POST', '/auth/mfa/setup',   middlewares.requireAuth, mfa.setup],
		['POST', '/auth/mfa/verify',  middlewares.requireAuth, mfa.verify],
		['POST', '/auth/mfa/disable', middlewares.requireAuth, mfa.disable],
	];

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google',          oauth.googleInit],
			['GET', '/auth/google/callback', oauth.googleCallback],
		);
	}

	return routes;
}
