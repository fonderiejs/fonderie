// ── Public API ───────────────────────────────────────────────────
export type { IUser, ISession, IMfaChallenge } from './types';
export { AuthModule }                          from './module';
export type { IAuthConfig }                    from './config';

// DTOs
export type { IUserDTO }  from './dtos/user';
export { toUserDTO }      from './dtos/user';

// Guards — used by other modules and user route handlers
export { withSession }          from './middlewares/session';
export { requireAuth }          from './middlewares/require-auth';
export { requireVerifiedEmail } from './middlewares/require-verified-email';
