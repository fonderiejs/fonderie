import type { Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { verifyToken } from '../services/jwt';
import type { IAccessPayload } from '../services/jwt';
import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';

// Reads the Bearer token or session cookie, populates ctx.user
// Does NOT reject — anonymous requests pass through
export function withSession(store: IStoreAdapter, config: IAuthConfig): Middleware {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);

	return async (ctx, next) => {
		const token = extractToken(ctx.request);
		if (!token) {
			return next();
		}

		const payload = verifyToken(token, config);
		if (!payload || payload.type !== 'access') {
			return next();
		}

		// Revocation: access tokens are bound to their refresh session via the
		// sid claim. Logout, rotation, and password change delete that row, so
		// the access token dies with it instead of living out its JWT expiry.
		// Tokens without a sid pass through: short-lived mfaPending tokens
		// (no session exists yet) and legacy tokens from before session
		// binding, which age out within one accessTokenDuration of deploy.
		if (payload.sid && !(await sessions.aliveBySid(payload.sid))) {
			return next();
		}

		const user = await users.findById(payload.sub);
		if (!user || user.suspended || user.deletedAt) {
			return next();
		}

		Object.assign(ctx, {
			user: {
				...user,
				loginMethod: payload.loginMethod ?? 'email',
				phoneVerified: payload.phoneVerified ?? false,
				mfaPending: (payload as IAccessPayload).mfaPending ?? false,
			},
		});

		return next();
	};
}

function extractToken(request: Request): string | null {
	const auth = request.headers.get('authorization');
	if (auth?.startsWith('Bearer ')) {
		return auth.slice(7);
	}

	const cookie = request.headers.get('cookie') ?? '';
	const match = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
	return match?.[1] ?? null;
}
