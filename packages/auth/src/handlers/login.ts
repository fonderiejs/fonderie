import { setErrorResponse }         from '@fonderie-js/core';
import type { IFonderieContext }     from '@fonderie-js/core';
import type { IStoreAdapter }        from '@fonderie-js/store';

import type { IAuthConfig }                    from '../config';
import { issueTokenPair, refreshTokenExpiry }  from '../services/jwt';
import { findUserByEmail, createSession }      from '../services/session';
import { verifyPassword }                      from '../services/password';
import { toUserDTO }                           from '../dtos/user';

const LoginSchema = {
	parse(body: unknown): { email: string; password: string } {
		if (
			typeof body !== 'object' || body === null ||
			typeof (body as Record<string, unknown>)['email']    !== 'string' ||
			typeof (body as Record<string, unknown>)['password'] !== 'string'
		) {
			throw new Error('Invalid');
		}

		return body as { email: string; password: string }
	},
}

export function loginHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body = ctx.meta['body']

		let parsed: { email: string; password: string }
		try {
			parsed = LoginSchema.parse(body);
		} catch {
			return setErrorResponse('INVALID_PARAMETER', 'email and password are required', 422);
		}

		const user = await findUserByEmail(parsed.email, store);
		if (!user || !user.passwordHash) {
			return setErrorResponse('INVALID_CREDENTIALS', 'Invalid credentials', 401);
		}

		const valid = await verifyPassword(parsed.password, user.passwordHash);
		if (!valid) {
			return setErrorResponse('INVALID_CREDENTIALS', 'Invalid credentials', 401);
		}

		if (user.suspended) {
			return setErrorResponse('ACCOUNT_SUSPENDED', 'Account suspended. Please contact support.', 403);
		}

		if (user.mfaEnabled) {
			return setErrorResponse('MFA_REQUIRED', 'Multi-factor authentication required', 202);
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		await createSession(user.id, refreshToken, refreshTokenExpiry(refreshToken), store);

		return Response.json(
			{
				reason:      'ACCOUNT_LOGIN',
				explanation: 'Login successful.',
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
