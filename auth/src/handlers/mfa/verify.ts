import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IAuthConfig }       from '../../config';
import { verifyTotpToken }       from '../../services/mfa';
import { issueTokenPair }        from '../../services/jwt';

export function mfaVerifyHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body  = ctx.meta['body'] as Record<string, unknown> | undefined
		const token = body?.['token'];

		if (typeof token !== 'string') {
			return Response.json({ error: 'token is required' }, { status: 422 });
		}

		const [{ mfa_secret: secret }] = await store.query<{ mfa_secret: string }>(
			`SELECT mfa_secret FROM fonderie_users WHERE id = $1`,
			[ctx.user.id],
		);

		if (!secret) {
			return Response.json({ error: 'MFA not configured' }, { status: 400 });
		}

		if (!verifyTotpToken(token, secret)) {
			return Response.json({ error: 'Invalid MFA token' }, { status: 401 });
		}

		// First verify — mark MFA as enabled
		if (!ctx.user.mfaEnabled) {
			await store.query(
				`UPDATE fonderie_users SET mfa_enabled = true WHERE id = $1`,
				[ctx.user.id],
			);
		}

		const { accessToken, refreshToken } = issueTokenPair(ctx.user.id, config);

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
