import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import type { IAuthConfig } from './config';

import { requireAuth, requireAnyAuth, requireVerified } from '@fonderie/core/middlewares';
import { requireEmailLogin } from './middlewares/require-email-login';
import { validate } from './middlewares/validate';
import {
	loginSchema,
	verifySchema,
	refreshSchema,
	mfaTokenSchema,
	registerSchema,
	updateEmailSchema,
	updatePhoneSchema,
	updateProfileSchema,
	resetPasswordSchema,
	changePasswordSchema,
	forgotPasswordSchema,
	updatePreferencesSchema,
} from './schemas';

import { mfaController } from './controllers/mfa.controller';
import { authController } from './controllers/auth.controller';
import { userController } from './controllers/user.controller';
import { oauthController } from './controllers/oauth.controller';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildAuthRoutes(
	store: IStoreAdapter,
	config: IAuthConfig,
	bus?: EventBus,
): RouteDefinition[] {
	const user = userController(store, bus);
	const auth = authController(store, config, bus);
	const oauth = oauthController(store, config);
	const mfa = mfaController(store, config, config.appName ?? 'Fonderie', bus);

	// Opt-in verification gate: only enforces email/phone verification when
	// requireVerification: true is set in config. Defaults to false so that
	// auth can be used without a courier/email provider.
	const verifyGate: Middleware = config.requireVerification
		? requireVerified
		: (_ctx, next) => next();

	const routes: RouteDefinition[] = [
		// Registration & Login (Public)
		['POST', '/auth/register', validate(registerSchema), auth.register],
		['POST', '/auth/login', validate(loginSchema), auth.login],

		// Token Management (Public)
		['POST', '/auth/refresh', validate(refreshSchema), auth.refresh],

		// Email — Password Recovery (Public)
		['POST', '/auth/email/forgot', validate(forgotPasswordSchema), auth.forgotPassword],
		['POST', '/auth/email/reset', validate(resetPasswordSchema), auth.resetPassword],

		// Verification (Protected — email or phone, determined by loginMethod)
		['POST', '/auth/verify', requireAuth, validate(verifySchema), auth.verify],
		['GET', '/auth/send-verification', requireAuth, auth.sendVerification],

		// Account Management (Protected)
		['POST', '/auth/logout', requireAuth, auth.logout],

		// User Profile (Protected; writes also gate on requireVerification)
		['GET', '/users', requireAuth, user.me],
		['PUT', '/users/profile', requireAuth, verifyGate, validate(updateProfileSchema), user.updateProfile],
		['PUT', '/users/preferences', requireAuth, verifyGate, validate(updatePreferencesSchema), user.updatePreferences],
		['PUT', '/users/email', requireAuth, verifyGate, validate(updateEmailSchema), user.updateEmail],
		['PUT', '/users/phone', requireAuth, verifyGate, validate(updatePhoneSchema), user.updatePhone],
		['PUT', '/users/password', requireAuth, validate(changePasswordSchema), user.changePassword],
		['DELETE', '/users', requireAuth, verifyGate, user.deleteMe],

		// MFA (email sessions only — requireVerified is always enforced here
		// because MFA is a security feature and email verification is meaningful)
		['POST', '/auth/mfa/setup', requireAuth, requireEmailLogin, requireVerified, mfa.setup],
		// /auth/mfa/verify accepts both mfaPending tokens (TOTP/backup-code login)
		// and full tokens (setup confirmation), so requireAnyAuth is used here.
		['POST', '/auth/mfa/verify', requireAnyAuth, requireEmailLogin, requireVerified, validate(mfaTokenSchema), mfa.verify],
		['POST', '/auth/mfa/disable', requireAuth, requireEmailLogin, requireVerified, validate(mfaTokenSchema), mfa.disable],
		[
			'POST',
			'/auth/mfa/backup-codes',
			requireAuth,
			requireEmailLogin,
			requireVerified,
			mfa.regenerateBackupCodes,
		],
	];

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google', oauth.googleInit],
			['GET', '/auth/google/callback', oauth.googleCallback],
		);
	}

	return routes;
}
