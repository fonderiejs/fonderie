import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { deleteSession } from '../services/session';

function resolveRefreshToken(ctx: IFonderieContext): string | null {
	// Mobile: token in request body
	const body = ctx.meta['body'] as Record<string, unknown> | undefined
	if (typeof body?.['refreshToken'] === 'string') return body['refreshToken'] as string

	// Web: token in HttpOnly cookie
	const cookie = ctx.request.headers.get('cookie') ?? ''
	const match  = cookie.match(/(?:^|;\s*)refresh_token=([^;]+)/)
	return match?.[1] ?? null
}

export function logoutHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const token = resolveRefreshToken(ctx)
		if (token) {
			await deleteSession(token, store).catch(() => undefined)
		}

		return Response.json(
			{ ok: true },
			{
				status: 200,
				headers: {
					'Set-Cookie': [
						'access_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
						'refresh_token=; HttpOnly; SameSite=Strict; Path=/auth/refresh; Max-Age=0',
					].join(', '),
				},
			},
		);
	}
}
