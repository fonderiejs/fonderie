import { setErrorResponse }    from '@fonderie-js/core'
import type { IFonderieContext } from '@fonderie-js/core'
import type { IStoreAdapter }    from '@fonderie-js/store'

import type { IAuthConfig }       from '../../config'
import { issueTokenPair }        from '../../services/jwt'

export function googleInitHandler(config: IAuthConfig) {
	return async (_ctx: IFonderieContext): Promise<Response> => {
		const google = config.google
		if (!google) {
			return setErrorResponse('NOT_CONFIGURED', 'Google OAuth not configured', 501);
		}

		const params = new URLSearchParams({
			client_id:     google.clientId,
			redirect_uri:  google.redirectUri,
			response_type: 'code',
			scope:         'openid email profile',
		});

		return Response.redirect(
			`https://accounts.google.com/o/oauth2/v2/auth?${params}`,
			302,
		);
	}
}

export function googleCallbackHandler(store: IStoreAdapter, config: IAuthConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		const google = config.google;
		if (!google) {
			return setErrorResponse('NOT_CONFIGURED', 'Google OAuth not configured', 501);
		}

		const url  = new URL(ctx.request.url);
		const code = url.searchParams.get('code');

		if (!code) {
			return setErrorResponse('INVALID_PARAMETER', 'Missing code', 400);
		}

		// Exchange code for tokens
		const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code,
				client_id:     google.clientId,
				client_secret: google.clientSecret,
				redirect_uri:  google.redirectUri,
				grant_type:    'authorization_code',
			}),
		});

		const tokenData = await tokenRes.json() as { id_token?: string }
		if (!tokenData.id_token) {
			return setErrorResponse('GOOGLE_AUTH_FAILED', 'OAuth token exchange failed', 400);
		}

		// Decode id_token to get email (no signature check needed — came from Google directly)
		const payload = JSON.parse(
			Buffer.from(tokenData.id_token.split('.')[1] ?? '', 'base64url').toString()
		) as { email?: string; sub?: string }

		if (!payload.email) {
			return setErrorResponse('GOOGLE_AUTH_FAILED', 'No email in OAuth response', 400);
		}

		// Upsert user
		const [user] = await store.query<{ id: string }>(
			`INSERT INTO fonderie_users (email, email_verified_at, provider, provider_id)
			VALUES ($1, now(), 'google', $2)
			ON CONFLICT (email) DO UPDATE
			SET provider = 'google', provider_id = $2
			RETURNING id`,
			[payload.email, payload.sub ?? ''],
		);

		if (!user) {
			return setErrorResponse('SERVER_ERROR', 'OAuth login failed', 500);
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		return Response.json(
			{
				reason:      'GOOGLE_AUTH_SUCCESS',
				explanation: 'Google authentication successful.',
				result: {
					tokens: { access: accessToken, refresh: refreshToken },
					user:   { id: user.id, email: payload.email },
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
