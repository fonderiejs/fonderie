import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import {
	meHandler,
	loginHandler,
	logoutHandler,
	refreshHandler,
	registerHandler,
	updateMeHandler,
	deleteMeHandler,
	mfaEnableHandler,
	mfaVerifyHandler,
	mfaDisableHandler,
	googleInitHandler,
	verifyEmailHandler,
	resetPasswordHandler,
	forgotPasswordHandler,
	googleCallbackHandler,
	resendVerificationHandler,
} from './handlers';
import { requireAuth }          from './middlewares/require-auth';
import { requireVerifiedEmail } from './middlewares/require-verified-email';
import type { IAuthConfig }     from './config';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildAuthRoutes(
	store: IStoreAdapter,
	config: IAuthConfig,
): RouteDefinition[] {
	const auth    = requireAuth();
	const verified = requireVerifiedEmail();

	const routes: RouteDefinition[] = [
		// Registration & Login (Public)
		['POST', '/auth/register',              registerHandler(store, config)],
		['POST', '/auth/login',                 loginHandler(store, config)],

		// Token Management (Public)
		['POST', '/auth/refresh-tokens',        refreshHandler(store, config)],

		// Password Recovery (Public)
		['POST', '/auth/forgot-password',       forgotPasswordHandler(store)],
		['POST', '/auth/reset-password',        resetPasswordHandler(store)],

		// Email Verification (Public)
		['POST', '/auth/verify-email',          verifyEmailHandler(store)],

		// Account Management (Protected)
		['POST', '/auth/logout',                auth, logoutHandler(store)],
		['POST', '/auth/send-verification-email', auth, resendVerificationHandler(store)],

		// User Profile (Protected + Verified)
		['GET',    '/users',         auth, verified, meHandler(store)],
		['PUT',    '/users/update',  auth, verified, updateMeHandler(store)],
		['DELETE', '/users',         auth, verified, deleteMeHandler(store)],

		// MFA - Multi-Factor Authentication (Protected)
		['POST', '/auth/mfa/setup',    auth, mfaEnableHandler(store, config.google?.clientId ?? 'Fonderie')],
		['POST', '/auth/mfa/verify',   auth, mfaVerifyHandler(store, config)],
		['POST', '/auth/mfa/disable',  auth, mfaDisableHandler(store)],
	];

	// OAuth 2.0 (Public)
	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google',          googleInitHandler(config)],
			['GET', '/auth/google/callback', googleCallbackHandler(store, config)],
		);
	}

	return routes
}
