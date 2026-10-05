// ── Public API ───────────────────────────────────────────────────
export type { IUser, ISession, IMfaChallenge } from './types';
export { AuthModule } from './module';
export type { IAccountEraser, IErasureSubject, IAuthConfig, IAuthSecrets, IAuthRuntimeConfig, IDataExportContributor } from './config';
export { AUTH_CONFIG_KEYS, MESSAGE_KEYS } from './config';
export type { AuthMessageKey } from './config';
// Built-in default templates for auth's notifications. Pass to courier via
// config.templates.defaults so the emails render out of the box; override any
// key per-app with a DB row / FS file.
export { DEFAULT_TEMPLATES } from './templates';

// DTOs
export type { IUserDTO } from './dtos/user';
export { toUserDTO } from './dtos/user';

export type {
	ILoginEventDTO,
	ILoginHistoryPageDTO,
	ISessionDTO,
} from './dtos/login-activity';
export {
	sanitizeLocation,
	resolveLocation,
} from './services/request-location';
export type {
	IRequestLocation,
	ILocationRequest,
	LocationResolver,
} from './services/request-location';

// Request validation — schemas are the enforced contract for every
// body-taking route; exported for docs generation and typed clients.
export { validate } from './middlewares/validate';
export * as schemas from './schemas';
export type { RegisterInput, LoginInput, ResetPasswordInput, ChangePasswordInput } from './schemas';

// Guards — used by other modules and user route handlers
export { withSession } from './middlewares/session';
export { requireAuth } from './middlewares/require-auth';

// Utilities
export { normalizeEmail, normalizeEmailSafe } from './services/email';

// Migration — import an existing user base (preserves identity; pairs with the
// `legacyVerify` config option for rehash-on-login).
export { importUser } from './migrate';
export { purgeSoftDeletedUsers, startUserRetention } from './services/retention';
export type { IPurgeOptions, IUserRetentionScheduleOptions } from './services/retention';
// Account deletion schedule: reminder, then purge with every brick's eraser (Phase 3).
export { runAccountDeletionSchedule, startAccountDeletionSchedule, authEraser, erasureHash } from './services/deletion-schedule';
export type { IDeletionScheduleResult } from './services/deletion-schedule';
export type { IImportUser } from './migrate';

// Production-readiness — validate the auth config (fatal on a weak jwtSecret in
// production). Runs automatically on AuthModule construction; exported for an
// app's own preflight.
export { validateAuthConfig } from './services/config-guard';

// Brute-force protection — on by default; see services/rate-limit.ts
export { buildAuthIpLimiter, buildAuthAccountLimiter } from './services/rate-limit';
export type { IAuthRateLimitConfig, AuthLimitedRoute } from './services/rate-limit';
export type { IAdminUserDTO } from './admin';
export { describeAuthAdminRoutes, toAdminUserDTO, toAdminUserPageDTO } from './admin';

// Session lifetimes per platform (X-Client-Kind: mobile | desktop | web) —
// docs/SESSION-DESIGN.md, Phase 3c. readAuthRuntimeConfig is the safe way to
// build a `resolve` from the app's config store.
export {
	CLIENT_KINDS,
	SESSION_POLICY_PRESETS,
	clientKindOf,
	configForClient,
	readAuthRuntimeConfig,
	sessionPolicyConfigKeys,
} from './services/session-policy';
export type { ClientKind, ISessionPolicy } from './services/session-policy';
