import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IAuthConfig }       from '../config';
import { issueTokenPair }        from '../services/jwt';
import { findUserByEmail }       from '../services/session';
import { verifyPassword }        from '../services/password';

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
			return Response.json({ error: 'email and password are required' }, { status: 422 });
		}

		const user = await findUserByEmail(parsed.email, store);
		if (!user || !user.passwordHash) {
			return Response.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		const valid = await verifyPassword(parsed.password, user.passwordHash);
		if (!valid) {
			return Response.json({ error: 'Invalid credentials' }, { status: 401 });
		}

		if (user.suspended) {
			return Response.json({ error: 'Account suspended' }, { status: 403 });
		}

		if (user.mfaEnabled) {
			// Issue a short-lived MFA challenge token instead of full access
			return Response.json({ mfaRequired: true }, { status: 200 });
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		return Response.json(
			{
				user: { id: user.id, email: user.email },
				accessToken,
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
