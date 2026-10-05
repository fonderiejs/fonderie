import type { LocationResolver } from './services/request-location';
import type { IAuthRateLimitConfig } from './services/rate-limit';
import type { ClientKind, ISessionPolicy } from './services/session-policy';
export const DEFAULT_VERIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes
// How long a device stays signed in WITHOUT being used (sliding: every refresh
// extends it). Messaging apps effectively never sign an idle device out;
// security comes from revocation (logged-in devices, reuse detection), not
// from expiry. Was 7d. docs/SESSION-DESIGN.md, Phase 3.
export const DEFAULT_SESSION_DURATION = '90d';
// Access tokens are refreshed silently, so they can be short: a stolen one is
// useful for at most this long even while its session lives. Was 24h.
export const DEFAULT_ACCESS_TOKEN_DURATION = '1h';

// Boot-time only — never resolvable at runtime
export interface IAuthSecrets {
	jwtSecret: string;
	// Previous signing secrets, still accepted for VERIFYING tokens while they
	// age out — so rotating jwtSecret signs nobody out. Rotation: move the old
	// secret here, set the new jwtSecret, deploy; remove it after the longest
	// session lifetime. Tokens carry a key id, so each is checked against one key.
	jwtPreviousSecrets?: string[];
	// Optional 32-byte key (64 hex chars, e.g. `openssl rand -hex 32`) that
	// encrypts TOTP secrets at rest (AES-256-GCM). Unset → secrets are stored
	// plaintext (backward-compatible). Set it in production; losing it makes
	// existing MFA secrets unrecoverable (users must re-enroll).
	mfaSecretKey?: string;
	google?: {
		// The web (OAuth client) id: the `aud` of the web redirect flow.
		clientId: string;
		// Web redirect flow only (GET /auth/google + /auth/google/callback).
		// A native-only setup leaves them out.
		clientSecret?: string;
		redirectUri?: string;
		// Client ids whose NATIVE ID tokens POST /auth/google/native accepts —
		// the Android, iOS and web client ids of the app's Google project (the
		// Android SDK mints tokens with aud = the web client id the app passes
		// as serverClientId; iOS with its own client id).
		nativeClientIds?: string[];
	};
	// Sign in with Apple. Unlike Google, Apple's client secret is not a static
	// string — it's a short-lived ES256 JWT minted from a .p8 key at token
	// exchange, so the config carries the signing material, not a secret.
	apple?: {
		// Services ID (Sign in with Apple identifier) — the `aud` for the WEB
		// redirect flow and the `sub` of the client-secret JWT.
		clientId: string;
		// Apple Developer Team ID — the `iss` of the client-secret JWT.
		teamId: string;
		// Key ID of the .p8 signing key — the `kid` header of the client secret.
		keyId: string;
		// Contents of the .p8 private key (PEM, `-----BEGIN PRIVATE KEY----- …`).
		privateKey: string;
		// Web form_post callback URL registered with Apple.
		redirectUri: string;
		// iOS bundle identifiers whose NATIVE identityToken we accept. Native Sign
		// in with Apple mints id_tokens with `aud` = the app's bundle id (NOT the
		// Services ID), so each must be allow-listed for POST /auth/apple/native.
		nativeClientIds?: string[];
	};
}

// Behavioral — safe to expose to admin dashboard
export interface IAuthRuntimeConfig {
	// Idle timeout: a session unused this long ends (sliding). Default 90d.
	sessionDuration?: string;
	// Optional absolute cap: a session this old ends at its next refresh, however
	// active — the user signs in again (e.g. '365d'). Unset: no cap.
	sessionMaxAge?: string;
	// Lifetimes per platform (X-Client-Kind at sign-in: mobile | desktop | web),
	// over the shared values above. Presets apply when nothing is set — see
	// services/session-policy.ts for the full order.
	sessionPolicies?: Partial<Record<ClientKind, ISessionPolicy>>;
	verificationCooldown?: number;
	mfa?: boolean;
	requireVerification?: boolean;
}

// Type-checked: adding/renaming a field in IAuthRuntimeConfig breaks this at compile time
// Per-platform keys: sessionPolicyConfigKeys(kind). readAuthRuntimeConfig reads them all.
export const AUTH_CONFIG_KEYS: Record<Exclude<keyof IAuthRuntimeConfig, 'sessionPolicies'>, string> = {
	sessionDuration:     'auth.session.duration',
	sessionMaxAge:       'auth.session.max_age',
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
	// Changing HOW an account can be signed into is a security event for the
	// account's owner, who may not be the person doing it. Both directions are
	// notified for the same reason password changes are.
	// A password was REVOKED because the account it sat on had never been
	// verified and an OAuth identity proved ownership of the mailbox. The
	// recipient is now known to own that address, so this reaches the right
	// person — and it is the only way they learn a password stopped working.
	passwordRevoked: 'password-revoked',
	// Welcome for an account CREATED by an OAuth sign-in. Distinct from
	// emailRegistration, which carries a verification PIN — an OAuth signup
	// arrives already verified by the provider and has nothing to confirm.
	oauthRegistration: 'oauth-registration',
	oauthLinked: 'oauth-linked',
	oauthUnlinked: 'oauth-unlinked',
	// Account deletion (docs/ACCOUNT-DELETION-DESIGN.md). Each goes to the ONE
	// verified channel the person chose — route these types to both 'email'
	// and 'sms' in courier: auth fills in only the chosen address, and the
	// other channel skips. SMS sends each template's text.
	accountDeletionCode: 'account-deletion-code',
	accountDeletionScheduled: 'account-deletion-scheduled',
	accountRestored: 'account-restored',
	// A week before deletion, once, if they never tried to sign in since asking.
	accountDeletionReminder: 'account-deletion-reminder',
} as const;

export type AuthMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

export const EVENT_KEYS = {
	userRegistered: 'fonderie.user.registered',
	userDeleted: 'fonderie.user.deleted',
	// Emitted by purgeSoftDeletedUsers (given a bus) once the row is hard-deleted.
	userPurged: 'fonderie.user.purged',
	// An archived account was kept: { userId }. Undo what deletion paused
	// (billing resumes a subscription set to end at the period's end).
	userRestored: 'fonderie.user.restored',
	emailVerified: 'fonderie.user.email_verified',
	passwordChanged: 'fonderie.user.password_changed',
	// Sessions the server revoked: { userId, sids (null = all), reason }. Reaches
	// the user's devices live (@fonderie/sse) so a revoked device signs out at
	// once. Reasons: 'terminated' (signed out from the devices list),
	// 'password-changed', 'admin', 'refresh-reuse' (theft signal).
	sessionRevoked: 'fonderie.session.revoked',
} as const;

export type AuthEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export interface IAuthConfig extends IAuthSecrets, IAuthRuntimeConfig {
	// Optional resolver: where is this request from? Auth calls it when it
	// records an auth event — every login attempt, every registration, and every
	// new session — and stores the result on that row (country / region / city
	// / time zone, plus network facts if the resolver knows them). Called at
	// most once per request. Absent ⇒ no location, exactly as before. The result
	// is sanitized and bounded; a resolver that throws or takes longer than
	// 500 ms leaves the row without a location and never fails the request.
	// In-process resolvers never approach that; the cap exists for a DB-backed
	// or hosted-API resolver (richer data: ISP, ASN, proxy/VPN).
	// On Vercel/Cloudflare: ({ headers }) => geoFromHeaders(headers, { trust })
	// from @fonderie/geo — zero infrastructure.
	location?: LocationResolver;
	// Adds the Secure attribute to auth cookies. Defaults to
	// NODE_ENV === 'production'; set explicitly when that heuristic is wrong.
	secureCookies?: boolean;
	// Brute-force protection — ON by default, backed by the module's own
	// store adapter (distributed-correct across instances with zero config).
	// Inject a store (e.g. RedisStore) for high-throughput deployments,
	// override individual rules, or set false to disable entirely.
	rateLimit?: IAuthRateLimitConfig | false;
	// Access-token lifetime (jsonwebtoken duration string). Default '1h'.
	// Access tokens are session-bound and die on logout / rotation /
	// password change regardless of this value; shorten it to bound the
	// window of a stolen token whose session is still alive.
	accessTokenDuration?: string;
	providers: ('email' | 'phone' | 'google' | 'github' | 'apple')[];
	appName?: string;
	// Base URL for the password-reset LINK. When set, forgot-password emits a
	// ready-built `resetUrl` (base + `token=<high-entropy token>`) in the
	// notification payload, so a template can offer a click-to-reset link
	// instead of only the 6-digit code. Unset → resetUrl is '' and only the
	// pin flows (unchanged behaviour). The token backs POST /auth/email/reset
	// with `{ token, password }`.
	passwordResetUrl?: string;
	resolve?: (ctx: { meta: Record<string, unknown> }) => Partial<IAuthRuntimeConfig>;
	// Override the HTTP path (and optionally method) of any auth route, keyed by a
	// stable id. Lets an app match an existing frontend's contract without a
	// gateway/shim, e.g. `{ forgotPassword: '/auth/forgot-password', updateProfile:
	// { method: 'PATCH', path: '/users/me' } }`. A bare string overrides the path;
	// an object can also change the method. Unset routes keep their defaults.
	routes?: Partial<Record<AuthRouteId, AuthRouteOverride>>;
	// Migrating an existing app onto Fonderie auth? Fonderie stores bcrypt
	// hashes, so a user imported with a foreign hash (argon2, scrypt, pbkdf2,
	// a framework's format, …) can't log in via the built-in bcrypt check.
	// Provide `legacyVerify` to validate that foreign hash on login; on the
	// first successful login Fonderie transparently re-stores the password as
	// bcrypt (rehash-on-login), so the legacy verifier is only ever hit once
	// per migrated user. Return true iff `plain` matches `hash`. If the imported
	// hashes are already bcrypt, you don't need this — the built-in check
	// accepts them and re-stores at the current cost factor automatically.
	legacyVerify?: (plain: string, hash: string) => boolean | Promise<boolean>;
	// SAR export contributors from other modules (see IDataExportContributor).
	dataExportContributors?: IDataExportContributor[];
	// Account deletion (docs/ACCOUNT-DELETION-DESIGN.md). A deleted account is
	// archived for `gracePeriodDays` (default 30 — inside GDPR's one-month
	// answer, CCPA's 45 days) before the purge erases it; meanwhile signing in
	// says when it will be deleted and that it can still be kept. Purge with
	// the SAME number (purgeSoftDeletedUsers / startUserRetention olderThanDays).
	accountDeletion?: IAccountDeletionConfig;
}

export interface IAccountDeletionConfig {
	/** Days an account stays archived (restorable) before the purge. Default 30. */
	gracePeriodDays?: number;
	/**
	 * Reasons a person may not delete their account YET — each returns null
	 * (fine) or the refusal to answer with. Other bricks own the facts: e.g.
	 * @fonderie/workspaces' `accountDeletionBlocker` refuses while the person
	 * owns a team with other members (transfer it first — design D4).
	 */
	blockers?: IAccountDeletionBlocker[];
	/** Days before the deletion date to remind (once, if no sign-in attempt since the request). Default 7. */
	reminderDaysBefore?: number;
	/**
	 * What every brick erases when an account is purged — run IN-PROCESS before
	 * the account row goes, so a failure keeps the account archived and the
	 * purge retries (nothing is half-erased). Each brick ships its own (e.g.
	 * @fonderie/workspaces `accountEraser(store)`); auth's runs first, always.
	 *
	 * ORDER MATTERS — billing before workspaces: billing finds the payment
	 * customers of the workspaces that go with the account through the
	 * workspace rows the workspaces eraser deletes. Recommended:
	 *   [billing, workspaces, media, customers, courier, webhooks, events]
	 */
	erasers?: IAccountEraser[];
}

/** Who is being erased — only for the erasers, never stored. */
export interface IErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface IAccountEraser {
	/** The brick, as the erasure receipt names it ('workspaces', 'media', …). */
	name: string;
	/** Erase or pseudonymize what this brick holds about the subject; say how many rows. */
	erase: (subject: IErasureSubject) => Promise<{ erased: number; kept?: string }>;
}

export type IAccountDeletionBlocker = (userId: string) => Promise<IAccountDeletionRefusal | null>;

export interface IAccountDeletionRefusal {
	reason: string;
	explanation: string;
	details?: Record<string, unknown>;
}

/** The grace period an app configured, else the design default (30 days). */
export const deletionGracePeriodDays = (config: Pick<IAuthConfig, 'accountDeletion'>): number => {
	const days = config.accountDeletion?.gracePeriodDays;
	return typeof days === 'number' && Number.isFinite(days) && days >= 0 ? days : 30;
};

// A module's contribution to the per-user data export (SAR). The app wires
// these (e.g. from @fonderie/workspaces) so auth can aggregate data owned by
// other packages without importing them.
export interface IDataExportContributor {
	name: string;
	collect: (userId: string) => Promise<unknown> | unknown;
}

// Stable ids for every auth route, for the `routes` path/method override map.
export type AuthRouteId =
	| 'providers' | 'unlinkOauth'
	| 'register' | 'login' | 'refresh'
	| 'forgotPassword' | 'resetPassword'
	| 'verifyEmail' | 'sendVerification'
	| 'logout'
	| 'me' | 'updateProfile' | 'updatePreferences' | 'updateEmail' | 'updatePhone' | 'changePassword' | 'deleteMe' | 'exportMe'
	| 'requestDeletion' | 'confirmDeletion' | 'restoreAccount'
	| 'loginHistory' | 'listSessions' | 'terminateSession' | 'terminateOtherSessions'
	| 'mfaSetup' | 'mfaVerify' | 'mfaDisable' | 'mfaBackupCodes';

export type AuthRouteOverride = string | { method?: string; path?: string };

/** Payload of fonderie.session.revoked. */
export interface ISessionRevokedEvent {
	userId: string;
	/** The revoked sessions' sids; null = every session of the user. */
	sids: Array<string | null> | null;
	reason: 'terminated' | 'password-changed' | 'admin' | 'refresh-reuse' | 'account-deleted';
}
