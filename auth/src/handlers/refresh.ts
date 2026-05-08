import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IAuthConfig }       from '../config';
import { findUserById }          from '../services/session';
import { verifyToken, issueTokenPair } from '../services/jwt';

export function refreshHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const cookie = ctx.request.headers.get('cookie') ?? '';
		const match  = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/);
		const token  = match?.[1];

		if (!token) {
			return Response.json({ error: 'No refresh token' }, { status: 401 });
		}

		const payload = verifyToken(token, config);
		if (!payload || payload.type !== 'refresh') {
			return Response.json({ error: 'Invalid refresh token' }, { status: 401 });
		}

		const user = await findUserById(payload.sub, store);
		if (!user || user.suspended || user.deletedAt) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		return Response.json(
			{ ok: true },
			{
				status: 200,
				headers: {
					'Set-Cookie': [
						`access_token=${accessToken}; HttpOnly; SameSite=Strict; Path=/`,
						`refresh_token=${refreshToken}; HttpOnly; SameSite=Strict; Path=/auth/refresh`,
					].join(', '),
				},
			},
		);
	}
}
