import { randomInt }            from 'node:crypto';

import { setErrorResponse }         from '@fonderie-js/core';
import type { IFonderieContext }     from '@fonderie-js/core';
import type { IStoreAdapter }        from '@fonderie-js/store';
import type { ICourierMessage }      from '@fonderie-js/core';

import type { IAuthConfig }          from '../config';
import { issueTokenPair, refreshTokenExpiry }        from '../services/jwt';
import { findUserByEmail, findUserById, createSession } from '../services/session';
import { hashPassword }              from '../services/password';
import { toUserDTO }                 from '../dtos/user';

export function registerHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body = ctx.meta['body'] as Record<string, unknown> | undefined

		const email     = body?.['email'];
		const password  = body?.['password'];
		const firstName = typeof body?.['firstName'] === 'string' ? body['firstName'] as string : null;
		const lastName  = typeof body?.['lastName']  === 'string' ? body['lastName']  as string : null;

		if (typeof email !== 'string' || typeof password !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'email and password are required', 422);
		}

		if (password.length < 8) {
			return setErrorResponse('INVALID_PARAMETER', 'password must be at least 8 characters', 422);
		}

		const existing = await findUserByEmail(email, store);
		if (existing) {
			return setErrorResponse('USER_ALREADY_EXISTS', 'Email already registered', 409);
		}

		const passwordHash = await hashPassword(password);

		const [row] = await store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, password_hash, first_name, last_name)
			VALUES ($1, $2, $3, $4)
			RETURNING id`,
			[email.toLowerCase().trim(), passwordHash, firstName, lastName],
		);

		if (!row) {
			return setErrorResponse('SERVER_ERROR', 'Registration failed', 500);
		}

		const verificationPin = randomInt(100000, 1000000).toString()

		await store.query(
			`INSERT INTO fonderie_email_verifications (token, user_id, expires_at)
			VALUES ($1, $2, $3)`,
			[verificationPin, row.id, new Date(Date.now() + 1000 * 60 * 60 * 24)],
		);

		ctx.meta['message'] = {
			type:      'email-verification',
			recipient: { email, phone: null, deviceToken: null },
			data:      { pin: verificationPin, firstName: firstName ?? '' },
		} satisfies ICourierMessage

		const user = await findUserById(row.id, store);
		if (!user) {
			return setErrorResponse('SERVER_ERROR', 'Registration failed', 500);
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		await createSession(user.id, refreshToken, refreshTokenExpiry(refreshToken), store);

		return Response.json(
			{
				reason:      'USER_REGISTERED',
				explanation: 'User registered successfully. Check your email for a verification code.',
				result: {
					tokens: { access: accessToken, refresh: refreshToken },
					user:   toUserDTO(user),
				},
			},
			{
				status: 201,
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
