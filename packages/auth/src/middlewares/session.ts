import type { Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { verifyToken } from '../services/jwt';
import type { IAccessPayload } from '../services/jwt';
import { UserModel } from '../models/user.model';

// Reads the Bearer token or session cookie, populates ctx.user
// Does NOT reject — anonymous requests pass through
export function withSession(store: IStoreAdapter, config: IAuthConfig): Middleware {
	const users = new UserModel(store);

	return async (ctx, next) => {
		const token = extractToken(ctx.request);
		if (!token) {
			return next();
		}

		const payload = verifyToken(token, config);
		if (!payload || payload.type !== 'access') {
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
