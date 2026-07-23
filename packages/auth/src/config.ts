import type { IAuthRateLimitConfig } from './services/rate-limit';
export const DEFAULT_VERIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_SESSION_DURATION = '7d';

// Boot-time only — never resolvable at runtime
export interface IAuthSecrets {
	jwtSecret: string;
	google?: {
		clientId: string;
		clientSecret: string;
		redirectUri: string;
	};
}

// Behavioral — safe to expose to admin dashboard
export interface IAuthRuntimeConfig {
	sessionDuration?: string;
	verificationCooldown?: number;
	mfa?: boolean;
	requireVerification?: boolean;
}

// Type-checked: adding/renaming a field in IAuthRuntimeConfig breaks this at compile time
export const AUTH_CONFIG_KEYS: Record<keyof IAuthRuntimeConfig, string> = {
	sessionDuration:     'auth.session.duration',
	verificationCooldown: 'auth.verification.cooldown',
	mfa:                 'auth.mfa.enabled',
	requireVerification: 'auth.verification.required',
} as const;

export const MESSAGE_KEYS = {
	emailRegistration: 'email-registration',
	emailVerification: 'email-verification',
	passwordReset: 'password-reset',
	phoneOtp: 'phone-otp',
	mfaEnabled: 'mfa-enabled',
	mfaDisabled: 'mfa-disabled',
	mfaBackupCodesRegenerated: 'mfa-backup-codes-regenerated',
	emailChanged: 'email-changed',
	phoneChanged: 'phone-changed',
} as const;

export type AuthMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

export const EVENT_KEYS = {
	userRegistered: 'fonderie.user.registered',
	userDeleted: 'fonderie.user.deleted',
	emailVerified: 'fonderie.user.email_verified',
	passwordChanged: 'fonderie.user.password_changed',
} as const;

export type AuthEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export interface IAuthConfig extends IAuthSecrets, IAuthRuntimeConfig {
	// Adds the Secure attribute to auth cookies. Defaults to
	// NODE_ENV === 'production'; set explicitly when that heuristic is wrong.
	secureCookies?: boolean;
	// Brute-force protection — ON by default, backed by the module's own
	// store adapter (distributed-correct across instances with zero config).
	// Inject a store (e.g. RedisStore) for high-throughput deployments,
	// override individual rules, or set false to disable entirely.
	rateLimit?: IAuthRateLimitConfig | false;
	// Access-token lifetime (jsonwebtoken duration string). Default '24h'.
	// Access tokens are session-bound and die on logout / rotation /
	// password change regardless of this value; shorten it to bound the
	// window of a stolen token whose session is still alive.
	accessTokenDuration?: string;
	providers: ('email' | 'phone' | 'google' | 'github')[];
	appName?: string;
	resolve?: (ctx: { meta: Record<string, unknown> }) => Partial<IAuthRuntimeConfig>;
	// Override the HTTP path (and optionally method) of any auth route, keyed by a
	// stable id. Lets an app match an existing frontend's contract without a
	// gateway/shim, e.g. `{ forgotPassword: '/auth/forgot-password', updateProfile:
	// { method: 'PATCH', path: '/users/me' } }`. A bare string overrides the path;
	// an object can also change the method. Unset routes keep their defaults.
	routes?: Partial<Record<AuthRouteId, AuthRouteOverride>>;
}

// Stable ids for every auth route, for the `routes` path/method override map.
export type AuthRouteId =
	| 'register' | 'login' | 'refresh'
	| 'forgotPassword' | 'resetPassword'
	| 'verifyEmail' | 'sendVerification'
	| 'logout'
	| 'me' | 'updateProfile' | 'updatePreferences' | 'updateEmail' | 'updatePhone' | 'changePassword' | 'deleteMe'
	| 'mfaSetup' | 'mfaVerify' | 'mfaDisable' | 'mfaBackupCodes';

export type AuthRouteOverride = string | { method?: string; path?: string };
