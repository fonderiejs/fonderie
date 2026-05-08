import type { Middleware }    from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import type { IAuthConfig }    from '../config';
import { verifyToken }        from '../services/jwt';
import { findUserById }       from '../services/session';

// Reads the Bearer token or session cookie, populates ctx.user
// Does NOT reject — anonymous requests pass through
export function sessionMiddleware(
	store: IStoreAdapter,
	config: IAuthConfig,
): Middleware {
	return async (ctx, next) => {
		const token = extractToken(ctx.request);
		if (!token) {
			return next();
		}

		const payload = verifyToken(token, config);
		if (!payload || payload.type !== 'access') {
			return next();
		}

		const user = await findUserById(payload.sub, store);
		if (!user || user.suspended || user.deletedAt) {
			return next();
		}

		Object.assign(ctx, { user });

		return next();
	}
}

function extractToken(request: Request): string | null {
	const auth = request.headers.get('authorization');
	if (auth?.startsWith('Bearer ')) {
		return auth.slice(7);
	}

	// Cookie fallback: access_token=<jwt>
	const cookie = request.headers.get('cookie') ?? '';
	const match  = cookie.match(/(?:^|;\s*)access_token=([^;]+)/);
	return match?.[1] ?? null;
}
