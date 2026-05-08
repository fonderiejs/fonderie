import type { IFonderieContext } from '@fonderie-js/core'
import type { IStoreAdapter }    from '@fonderie-js/store'

import type { IAuthConfig }       from '../../config'
import { issueTokenPair }        from '../../services/jwt'

export function googleInitHandler(config: IAuthConfig) {
	return async (_ctx: IFonderieContext): Promise<Response> => {
		const google = config.google
		if (!google) {
			return Response.json({ error: 'Google OAuth not configured' }, { status: 501 });
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
			return Response.json({ error: 'Google OAuth not configured' }, { status: 501 });
		}

		const url  = new URL(ctx.request.url);
		const code = url.searchParams.get('code');

		if (!code) {
			return Response.json({ error: 'Missing code' }, { status: 400 });
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
			return Response.json({ error: 'OAuth failed' }, { status: 400 });
		}

		// Decode id_token to get email (no signature check needed — came from Google directly)
		const payload = JSON.parse(
			Buffer.from(tokenData.id_token.split('.')[1] ?? '', 'base64url').toString()
		) as { email?: string; sub?: string }

		if (!payload.email) {
			return Response.json({ error: 'No email in OAuth response' }, { status: 400 });
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
			return Response.json({ error: 'OAuth login failed' }, { status: 500 });
		}

		const { accessToken, refreshToken } = issueTokenPair(user.id, config);

		return Response.json(
			{ user: { id: user.id, email: payload.email } },
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
