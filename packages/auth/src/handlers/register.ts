import { randomBytes }          from 'node:crypto';

import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';
import type { ICourierMessage }   from '@fonderie-js/core';

import type { IAuthConfig }      from '../config';

import { issueTokenPair }        from '../services/jwt';
import { findUserByEmail }       from '../services/session';
import { hashPassword }          from '../services/password';

export function registerHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const body = ctx.meta['body'] as Record<string, unknown> | undefined

		const email    = body?.['email'];
		const password = body?.['password'];

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

		const [user] = await store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, password_hash)
			VALUES ($1, $2)
			RETURNING id`,
			[email.toLowerCase().trim(), passwordHash],
		);

		if (!user) {
			return Response.json({ error: 'Registration failed' }, { status: 500 });
		}

		const verificationToken = randomBytes(32).toString('hex')

		await store.query(
			`INSERT INTO fonderie_email_verifications (token, user_id, expires_at)
			VALUES ($1, $2, $3)`,
			[verificationToken, user.id, new Date(Date.now() + 1000 * 60 * 60 * 24)],
		);

		 // Email sending is handled by @fonderie-js/courier — emit via ctx.meta
		ctx.meta['message'] = {
			type:      'email-verification',
			recipient: { email, phone: null, deviceToken: null },
			data:      { token: verificationToken },
		} satisfies ICourierMessage

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		return Response.json(
			{
				user: { id: user.id, email },
				accessToken,
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
