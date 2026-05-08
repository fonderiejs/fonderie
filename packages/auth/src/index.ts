// ── Public API ───────────────────────────────────────────────────
export type { IUser, ISession } from './types';
export { AuthModule }           from './module';
export type { IAuthConfig }     from './config';

// Guards — used by other modules and user route handlers
export { sessionMiddleware }    from './middlewares/session';
export { requireAuth }          from './middlewares/require-auth';
export { requireVerifiedEmail } from './middlewares/require-verified-email';
