import { setErrorResponse }  from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IAuthConfig }       from '../../config';
import { verifyTotpToken }       from '../../services/mfa';
import { issueTokenPair }        from '../../services/jwt';

export function mfaVerifyHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const body  = ctx.meta['body'] as Record<string, unknown> | undefined
		const token = body?.['token'];

		if (typeof token !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'token is required', 422);
		}

		const [row] = await store.query<{ mfa_secret: string | null }>(
			`SELECT mfa_secret FROM fonderie_users WHERE id = $1`,
			[ctx.user.id],
		);
		const secret = row?.mfa_secret;

		if (!secret) {
			return setErrorResponse('MFA_NOT_CONFIGURED', 'MFA not configured', 400);
		}

		if (!verifyTotpToken(token, secret)) {
			return setErrorResponse('INVALID_CODE', 'Invalid MFA token', 401);
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
			{ reason: 'MFA_ENABLED', explanation: 'MFA enabled successfully.' },
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
