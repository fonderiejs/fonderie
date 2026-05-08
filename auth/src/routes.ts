import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import {
	loginHandler,
	logoutHandler,
	refreshHandler,
	registerHandler,
	mfaEnableHandler,
	mfaVerifyHandler,
	googleInitHandler,
	verifyEmailHandler,
	resetPasswordHandler,
	forgotPasswordHandler,
	googleCallbackHandler,
} from './handlers';
import type { IAuthConfig }    from './config';

type RouteDefinition = [string, string, Middleware]

export function buildAuthRoutes(
	store: IStoreAdapter,
	config: IAuthConfig,
): RouteDefinition[] {
	const routes: RouteDefinition[] = [
		['POST', '/auth/register',        registerHandler(store, config)],
		['POST', '/auth/login',           loginHandler(store, config)],
		['POST', '/auth/logout',          logoutHandler()],
		['POST', '/auth/refresh',         refreshHandler(store, config)],
		['POST', '/auth/verify-email',    verifyEmailHandler(store)],
		['POST', '/auth/forgot-password', forgotPasswordHandler(store)],
		['POST', '/auth/reset-password',  resetPasswordHandler(store)],
		['POST', '/auth/mfa/enable',      mfaEnableHandler(store, config.google?.clientId ?? 'Fonderie')],
		['POST', '/auth/mfa/verify',      mfaVerifyHandler(store, config)],
	];

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google',          googleInitHandler(config)],
			['GET', '/auth/google/callback', googleCallbackHandler(store, config)],
		);
	}

	return routes
}
