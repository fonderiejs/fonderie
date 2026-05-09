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
} from './handlers';
import type { IAuthConfig } from './config';

type RouteDefinition = [string, string, Middleware]

export function buildAuthRoutes(
	store: IStoreAdapter,
	config: IAuthConfig,
): RouteDefinition[] {
	const routes: RouteDefinition[] = [
		// Public
		['POST', '/auth/register',        registerHandler(store, config)],
		['POST', '/auth/login',           loginHandler(store, config)],
		['POST', '/auth/refresh',         refreshHandler(store, config)],
		['POST', '/auth/verify-email',    verifyEmailHandler(store, config)],
		['POST', '/auth/forgot-password', forgotPasswordHandler(store)],
		['POST', '/auth/reset-password',  resetPasswordHandler(store)],

		// Authenticated
		['POST',   '/auth/logout',     logoutHandler(store)],
		['GET',    '/users/me',        meHandler(store)],
		['PATCH',  '/users/me',        updateMeHandler(store)],
		['DELETE', '/users/me',        deleteMeHandler(store)],

		// MFA
		['POST', '/auth/mfa/enable',   mfaEnableHandler(store, config.google?.clientId ?? 'Fonderie')],
		['POST', '/auth/mfa/verify',   mfaVerifyHandler(store, config)],
		['POST', '/auth/mfa/disable',  mfaDisableHandler(store)],
	];

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google',          googleInitHandler(config)],
			['GET', '/auth/google/callback', googleCallbackHandler(store, config)],
		);
	}

	return routes
}
