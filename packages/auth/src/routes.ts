import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import type { IAuthConfig, AuthRouteId } from './config';

import { requireAuth, requireAnyAuth, requireVerified } from '@fonderie/core/middlewares';
import { requireEmailLogin } from './middlewares/require-email-login';
import { validate } from './middlewares/validate';
import { buildAuthIpLimiter, buildAuthAccountLimiter } from './services/rate-limit';
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
	const user = userController(store, config, bus);
	const auth = authController(store, config, bus);
	const oauth = oauthController(store, config);
	const mfa = mfaController(store, config, config.appName ?? 'Fonderie', bus);

	// Opt-in verification gate: only enforces email/phone verification when
	// requireVerification: true is set in config. Defaults to false so that
	// auth can be used without a courier/email provider.
	const verifyGate: Middleware = config.requireVerification
		? requireVerified
		: (_ctx, next) => next();

	// Brute-force protection — on by default, backed by the module's own
	// store; see services/rate-limit.ts. Null when disabled via config.
	const passthrough: Middleware = (_ctx, next) => next();
	// IP limit runs before validate(); account limit runs after (keys on the
	// validated, bounded email — never raw attacker input).
	const ipLimit = (route: Parameters<typeof buildAuthIpLimiter>[0]): Middleware =>
		buildAuthIpLimiter(route, store, config.rateLimit) ?? passthrough;
	const acctLimit = (route: Parameters<typeof buildAuthAccountLimiter>[0]): Middleware =>
		buildAuthAccountLimiter(route, store, config.rateLimit) ?? passthrough;

	// Apply an optional per-route method/path override (config.routes) keyed by a
	// stable id, so an app can match an existing frontend's contract without a shim.
	const R = (id: AuthRouteId, method: string, path: string, ...handlers: Middleware[]): RouteDefinition => {
		const o = config.routes?.[id];
		if (!o) return [method, path, ...handlers];
		if (typeof o === 'string') return [method, o, ...handlers];
		return [o.method ?? method, o.path ?? path, ...handlers];
	};

	const routes: RouteDefinition[] = [
		// Registration & Login (Public)
		R('register', 'POST', '/auth/register', ipLimit('register'), validate(registerSchema), auth.register),
		R('login', 'POST', '/auth/login', ipLimit('login'), validate(loginSchema), acctLimit('login'), auth.login),

		// Token Management (Public)
		R('refresh', 'POST', '/auth/refresh', validate(refreshSchema), auth.refresh),

		// Email — Password Recovery (Public)
		R('forgotPassword', 'POST', '/auth/email/forgot', ipLimit('forgot'), validate(forgotPasswordSchema), acctLimit('forgot'), auth.forgotPassword),
		R('resetPassword', 'POST', '/auth/email/reset', validate(resetPasswordSchema), auth.resetPassword),

		// Verification (Protected — email or phone, determined by loginMethod)
		R('verifyEmail', 'POST', '/auth/verify', requireAuth, validate(verifySchema), auth.verify),
		R('sendVerification', 'GET', '/auth/send-verification', requireAuth, auth.sendVerification),

		// Account Management (Protected)
		R('logout', 'POST', '/auth/logout', requireAuth, validate(refreshSchema), auth.logout),

		// User Profile (Protected; writes also gate on requireVerification)
		R('me', 'GET', '/users', requireAuth, user.me),
		R('updateProfile', 'PUT', '/users/profile', requireAuth, verifyGate, validate(updateProfileSchema), user.updateProfile),
		R('updatePreferences', 'PUT', '/users/preferences', requireAuth, verifyGate, validate(updatePreferencesSchema), user.updatePreferences),
		R('updateEmail', 'PUT', '/users/email', requireAuth, verifyGate, validate(updateEmailSchema), user.updateEmail),
		R('updatePhone', 'PUT', '/users/phone', requireAuth, verifyGate, validate(updatePhoneSchema), user.updatePhone),
		R('changePassword', 'PUT', '/users/password', requireAuth, validate(changePasswordSchema), user.changePassword),
		R('deleteMe', 'DELETE', '/users', requireAuth, verifyGate, user.deleteMe),

		// MFA (email sessions only — requireVerified is always enforced here
		// because MFA is a security feature and email verification is meaningful)
		R('mfaSetup', 'POST', '/auth/mfa/setup', requireAuth, requireEmailLogin, requireVerified, mfa.setup),
		// /auth/mfa/verify accepts both mfaPending tokens (TOTP/backup-code login)
		// and full tokens (setup confirmation), so requireAnyAuth is used here.
		R('mfaVerify', 'POST', '/auth/mfa/verify', ipLimit('mfaVerify'), requireAnyAuth, requireEmailLogin, requireVerified, validate(mfaTokenSchema), mfa.verify),
		R('mfaDisable', 'POST', '/auth/mfa/disable', requireAuth, requireEmailLogin, requireVerified, validate(mfaTokenSchema), mfa.disable),
		R('mfaBackupCodes', 'POST', '/auth/mfa/backup-codes', requireAuth, requireEmailLogin, requireVerified, validate(mfaTokenSchema), mfa.regenerateBackupCodes),
	];

	if (config.providers.includes('google')) {
		routes.push(
			['GET', '/auth/google', oauth.googleInit],
			['GET', '/auth/google/callback', oauth.googleCallback],
		);
	}

	return routes;
}
