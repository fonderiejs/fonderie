import type { IFonderieContext }                    from '@fonderie-js/core';
import type { IStoreAdapter }                       from '@fonderie-js/store';

import type { IAuthConfig }                         from '../config';
import { findUserById, deleteSession,
         createSession, sessionExists }             from '../services/session';
import { verifyToken, issueTokenPair,
         refreshTokenExpiry }                       from '../services/jwt';
import { toUserDTO }                                from '../dtos/user';

function resolveRefreshToken(ctx: IFonderieContext): string | null {
	// Mobile: token in request body
	const body = ctx.meta['body'] as Record<string, unknown> | undefined
	if (typeof body?.['refreshToken'] === 'string') return body['refreshToken'] as string

	// Web: token in HttpOnly cookie
	const cookie = ctx.request.headers.get('cookie') ?? ''
	const match  = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/)
	return match?.[1] ?? null
}

export function refreshHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const token = resolveRefreshToken(ctx)

		if (!token) {
			return Response.json({ error: 'No refresh token' }, { status: 401 });
		}

		const payload = verifyToken(token, config);
		if (!payload || payload.type !== 'refresh') {
			return Response.json({ error: 'Invalid refresh token' }, { status: 401 });
		}

		const valid = await sessionExists(token, store);
		if (!valid) {
			return Response.json({ error: 'Session expired or already revoked' }, { status: 401 });
		}

		const user = await findUserById(payload.sub, store);
		if (!user || user.suspended || user.deletedAt) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Rotate: revoke old session, issue new pair
		await deleteSession(token, store);
		const { accessToken, refreshToken } = issueTokenPair(user.id, config);
		await createSession(user.id, refreshToken, refreshTokenExpiry(refreshToken), store);

		return Response.json(
			{
				reason:      'TOKENS_REFRESHED',
				explanation: 'Tokens refreshed successfully.',
				result: {
					tokens: { accessToken, refreshToken },
					user:   toUserDTO(user),
				},
			},
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
