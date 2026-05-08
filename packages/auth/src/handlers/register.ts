import { randomBytes }          from 'node:crypto';

import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';
import type { ICourierMessage }   from '@fonderie-js/core';

import type { IAuthConfig }      from '../config';

import { issueTokenPair, refreshTokenExpiry }        from '../services/jwt';
import { findUserByEmail, findUserById, createSession } from '../services/session';
import { hashPassword }                               from '../services/password';
import { toUserDTO }                                  from '../dtos/user';

export function registerHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body = ctx.meta['body'] as Record<string, unknown> | undefined

		const email     = body?.['email'];
		const password  = body?.['password'];
		const firstName = typeof body?.['firstName'] === 'string' ? body['firstName'] as string : null;
		const lastName  = typeof body?.['lastName']  === 'string' ? body['lastName']  as string : null;

		if (typeof email !== 'string' || typeof password !== 'string') {
			return Response.json({ error: 'email and password are required' }, { status: 422 });
		}

		if (password.length < 8) {
			return Response.json({ error: 'password must be at least 8 characters' }, { status: 422 });
		}

		const existing = await findUserByEmail(email, store);
		if (existing) {
			return Response.json({ error: 'Email already registered' }, { status: 409 });
		}

		const passwordHash = await hashPassword(password);

		const [row] = await store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, password_hash, first_name, last_name)
			VALUES ($1, $2, $3, $4)
			RETURNING id`,
			[email.toLowerCase().trim(), passwordHash, firstName, lastName],
		);

		if (!row) {
			return Response.json({ error: 'Registration failed' }, { status: 500 });
		}

		const verificationToken = randomBytes(32).toString('hex')

		await store.query(
			`INSERT INTO fonderie_email_verifications (token, user_id, expires_at)
			VALUES ($1, $2, $3)`,
			[verificationToken, row.id, new Date(Date.now() + 1000 * 60 * 60 * 24)],
		);

		ctx.meta['message'] = {
			type:      'email-verification',
			recipient: { email, phone: null, deviceToken: null },
			data:      { token: verificationToken, firstName: firstName ?? '' },
		} satisfies ICourierMessage

		const user = await findUserById(row.id, store);
		if (!user) {
			return Response.json({ error: 'Registration failed' }, { status: 500 });
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		await createSession(user.id, refreshToken, refreshTokenExpiry(refreshToken), store);

		return Response.json(
			{ user: toUserDTO(user), accessToken, refreshToken },
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
