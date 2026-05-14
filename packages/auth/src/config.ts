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
}

// Type-checked: adding/renaming a field in IAuthRuntimeConfig breaks this at compile time
export const AUTH_CONFIG_KEYS: Record<keyof IAuthRuntimeConfig, string> = {
	sessionDuration: 'auth.session.duration',
	verificationCooldown: 'auth.verification.cooldown',
	mfa: 'auth.mfa.enabled',
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
	userRegistered: 'user.registered',
	userDeleted: 'user.deleted',
	emailVerified: 'user.email_verified',
	passwordChanged: 'user.password_changed',
} as const;

export type AuthEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export interface IAuthConfig extends IAuthSecrets, IAuthRuntimeConfig {
	providers: ('email' | 'phone' | 'google' | 'github')[];
	appName?: string;
	resolve?: (ctx: { meta: Record<string, unknown> }) => Partial<IAuthRuntimeConfig>;
}
