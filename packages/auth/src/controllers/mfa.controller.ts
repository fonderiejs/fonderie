import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IAuthConfig }                                     from '../config';
import { issueTokenPair, refreshTokenExpiry }                    from '../services/jwt';
import { generateTotpSecret, generateTotpUri, verifyTotpToken } from '../services/mfa';
import { toUserDTO }                                            from '../dtos/user';
import { UserModel }                                            from '../models/user.model';
import { SessionModel }                                         from '../models/session.model';

export function mfaController(store: IStoreAdapter, config: IAuthConfig, issuer: string) {
	const users    = new UserModel(store);
	const sessions = new SessionModel(store);

	return {
		setup: async (ctx: IFonderieContext): Promise<Response> => {
			const secret = generateTotpSecret();
			const uri    = generateTotpUri(ctx.user!.email ?? ctx.user!.id, secret, issuer);

			await users.saveMfaSecret(ctx.user!.id, secret);

			return setApiResponse(HTTP.OK, 'MFA_SETUP', 'Scan the QR code with your authenticator app.', { secret, uri });
		},

		verify: async (ctx: IFonderieContext): Promise<Response> => {
			const body  = ctx.meta['body'] as Record<string, unknown> | undefined;
			const token = body?.['token'];

			if (typeof token !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'token is required');
			}

			const secret = await users.getMfaSecret(ctx.user!.id);
			if (!secret) {
				return setApiResponse(HTTP.BAD_REQUEST, 'MFA_NOT_CONFIGURED', 'MFA not configured');
			}

			if (!verifyTotpToken(token, secret)) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid MFA token');
			}

			if (!ctx.user!.mfaEnabled) {
				await users.enableMfa(ctx.user!.id);
			}

			const { accessToken, refreshToken } = issueTokenPair(ctx.user!.id, config);
			await sessions.create(ctx.user!.id, refreshToken, refreshTokenExpiry(refreshToken));

			const fullUser = await users.findById(ctx.user!.id);
			if (!fullUser) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'User not found after MFA enable');
			}

			return Response.json(
				{
					reason:      'MFA_ENABLED',
					explanation: 'MFA enabled successfully.',
					result: {
						tokens: { access: accessToken, refresh: refreshToken },
						user:   toUserDTO(fullUser),
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
		},

		disable: async (ctx: IFonderieContext): Promise<Response> => {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const code = body?.['code'];

			if (typeof code !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'TOTP code is required');
			}

			const user = await users.findById(ctx.user!.id);
			if (!user || !user.mfaEnabled) {
				return setApiResponse(HTTP.BAD_REQUEST, 'MFA_NOT_ENABLED', 'MFA is not enabled');
			}

			const secret = (user as unknown as { mfaSecret: string | null }).mfaSecret;
			if (!secret || !verifyTotpToken(code, secret)) {
				return setApiResponse(HTTP.UNAUTHORIZED, 'INVALID_CODE', 'Invalid TOTP code');
			}

			await users.disableMfa(ctx.user!.id);

			return setApiResponse(HTTP.OK, 'MFA_DISABLED', 'MFA disabled successfully.');
		},
	};
}
