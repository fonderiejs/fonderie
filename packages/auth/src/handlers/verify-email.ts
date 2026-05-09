import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { setErrorResponse }                         from '@fonderie-js/core';
import type { IAuthConfig }                         from '../config';
import { issueTokenPair, refreshTokenExpiry }       from '../services/jwt';
import { findUserById, createSession }              from '../services/session';
import { toUserDTO }                                from '../dtos/user';

export function verifyEmailHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body  = ctx.meta['body'] as Record<string, unknown> | undefined
		const token = body?.['token'];

		if (typeof token !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'token is required', 422);
		}

		const [row] = await store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_email_verifications
			WHERE token = $1`,
			[token],
		);

		if (!row) {
			return setErrorResponse('EMAIL_VERIFICATION_FAILED', 'Invalid or expired token', 400);
		}

		if (new Date() > new Date(row.expires_at)) {
			return setErrorResponse('EMAIL_VERIFICATION_FAILED', 'Token expired', 400);
		}

		await store.transaction(async tx => {
			await Promise.all([
				tx.query(
					`UPDATE fonderie_users SET email_verified_at = now(), updated_at = now() WHERE id = $1`,
					[row.user_id],
				),
				tx.query(
					`DELETE FROM fonderie_email_verifications WHERE token = $1`,
					[token],
				),
			]);
		});

		const user = await findUserById(row.user_id, store);
		if (!user) {
			return setErrorResponse('NOT_FOUND', 'User not found', 404);
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);
		await createSession(user.id, refreshToken, refreshTokenExpiry(refreshToken), store);

		return Response.json(
			{
				reason:      'EMAIL_VERIFIED',
				explanation: 'Email verified successfully.',
				result: {
					tokens: { access: accessToken, refresh: refreshToken },
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
