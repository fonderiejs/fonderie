import { tokenPairCookies, cookieHeaders } from '../services/cookies';
import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { issueTokenPair, refreshTokenExpiry } from '../services/jwt';
import { toUserDTO } from '../dtos/user';
import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import { normalizeEmailSafe } from '../services/email';

export function oauthController(store: IStoreAdapter, config: IAuthConfig) {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);

	return {
		googleInit: async (_ctx: IFonderieContext): Promise<Response> => {
			const google = config.google;
			if (!google) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_CONFIGURED',
					'Google OAuth not configured',
				);
			}

			const params = new URLSearchParams({
				client_id: google.clientId,
				redirect_uri: google.redirectUri,
				response_type: 'code',
				scope: 'openid email profile',
			});

			const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

			return setApiResponse(
				HTTP.OK,
				'GOOGLE_AUTH_URL',
				'Redirect the user to the returned URL to begin Google OAuth.',
				{ url },
			);
		},

		googleCallback: async (ctx: IFonderieContext): Promise<Response> => {
			const google = config.google;
			if (!google) {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'NOT_CONFIGURED',
					'Google OAuth not configured',
				);
			}

			const url = new URL(ctx.request.url);
			const code = url.searchParams.get('code');

			if (!code) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Missing code');
			}

			const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code,
					client_id: google.clientId,
					client_secret: google.clientSecret,
					redirect_uri: google.redirectUri,
					grant_type: 'authorization_code',
				}),
			});

			const tokenData = (await tokenRes.json()) as { id_token?: string };
			if (!tokenData.id_token) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'GOOGLE_AUTH_FAILED',
					'OAuth token exchange failed',
				);
			}

			const payload = JSON.parse(
				Buffer.from(tokenData.id_token.split('.')[1] ?? '', 'base64url').toString(),
			) as { email?: string; sub?: string };

			if (!payload.email) {
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'No email in OAuth response');
			}

			const normalizedEmail = normalizeEmailSafe(payload.email);
			if (!normalizedEmail) {
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'Invalid email in OAuth response');
			}

			const upserted = await users.upsertByProvider(normalizedEmail, 'google', payload.sub ?? '');
			if (!upserted) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'OAuth login failed');
			}

			const fullUser = await users.findById(upserted.id);
			if (!fullUser) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'OAuth login failed');
			}

			const { accessToken, refreshToken, sid } = issueTokenPair(upserted.id, config, {
				loginMethod: 'google',
			});
			await sessions.create(upserted.id, refreshToken, refreshTokenExpiry(refreshToken), sid);

			return Response.json(
				{
					reason: 'GOOGLE_AUTH_SUCCESS',
					explanation: 'Google authentication successful.',
					result: {
						tokens: { access: accessToken, refresh: refreshToken },
						user: toUserDTO(fullUser),
					},
				},
				{
					status: 200,
					headers: cookieHeaders(tokenPairCookies(accessToken, refreshToken, config)),
				},
			);
		},
	};
}
