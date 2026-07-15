// ── Public API ───────────────────────────────────────────────────
export type { IUser, ISession, IMfaChallenge } from './types';
export { AuthModule } from './module';
export type { IAuthConfig, IAuthSecrets, IAuthRuntimeConfig } from './config';
export { AUTH_CONFIG_KEYS, MESSAGE_KEYS } from './config';
export type { AuthMessageKey } from './config';

// DTOs
export type { IUserDTO } from './dtos/user';
export { toUserDTO } from './dtos/user';

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

// Brute-force protection — on by default; see services/rate-limit.ts
export { buildAuthIpLimiter, buildAuthAccountLimiter } from './services/rate-limit';
export type { IAuthRateLimitConfig, AuthLimitedRoute } from './services/rate-limit';
