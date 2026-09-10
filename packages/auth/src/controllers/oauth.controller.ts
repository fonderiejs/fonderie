import { randomBytes } from 'node:crypto';

import { tokenPairCookies, cookieHeaders } from '../services/cookies';
import { setApiResponse, HTTP, constantTimeEqual } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { issueTokenPair, refreshTokenExpiry } from '../services/jwt';
import { toUserDTO } from '../dtos/user';
import { UserModel } from '../models/user.model';
import { SessionModel } from '../models/session.model';
import { LoginEventModel } from '../models/login-event.model';
import { requestMeta } from '../services/request-meta';
import { normalizeEmailSafe } from '../services/email';

export function oauthController(store: IStoreAdapter, config: IAuthConfig) {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);
	const loginEvents = new LoginEventModel(store);

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

			// CSRF `state`: a random value that must round-trip — bound to THIS
			// browser via a short-lived cookie and echoed back by Google in the
			// callback query. Without it, an attacker can complete the callback
			// with a code from THEIR OWN Google account and silently log the
			// victim's browser into the attacker's account (login CSRF).
			const state = randomBytes(16).toString('hex');

			const params = new URLSearchParams({
				client_id: google.clientId,
				redirect_uri: google.redirectUri,
				response_type: 'code',
				scope: 'openid email profile',
				state,
			});

			const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

			const secure = (config.secureCookies ?? process.env['NODE_ENV'] === 'production') ? '; Secure' : '';
			return Response.json(
				{
					reason: 'GOOGLE_AUTH_URL',
					explanation: 'Redirect the user to the returned URL to begin Google OAuth.',
					result: { url },
				},
				{
					status: 200,
					// SameSite=Lax (not Strict): the cookie must be sent on the
					// top-level cross-site redirect back from Google.
					headers: cookieHeaders([
						`oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure}`,
					]),
				},
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

			// CSRF check: the state Google echoed back must equal the value we
			// bound to this browser in googleInit's cookie.
			const returnedState = url.searchParams.get('state') ?? '';
			const cookieHeader = ctx.request.headers.get('cookie') ?? '';
			const expectedState = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1] ?? '';
			if (
				!returnedState ||
				!expectedState ||
				!constantTimeEqual(Buffer.from(returnedState), Buffer.from(expectedState))
			) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'GOOGLE_AUTH_FAILED',
					'OAuth state mismatch — restart the sign-in flow',
				);
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

			// The id_token arrives DIRECTLY from Google's token endpoint over TLS
			// in a confidential-client code exchange, so per OIDC Core §3.1.3.7
			// signature verification may be skipped — but the claims still must
			// be checked before trusting them.
			const payload = JSON.parse(
				Buffer.from(tokenData.id_token.split('.')[1] ?? '', 'base64url').toString(),
			) as { email?: string; sub?: string; aud?: string; iss?: string; exp?: number; email_verified?: boolean };

			if (payload.aud !== google.clientId) {
				// A token minted for a DIFFERENT client must never log anyone in here.
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'OAuth token audience mismatch');
			}
			if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'OAuth token issuer mismatch');
			}
			if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'OAuth token expired');
			}

			if (!payload.email) {
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'No email in OAuth response');
			}

			// Account linking is BY EMAIL (upsertByProvider), so an unverified
			// Google email would let its holder take over an existing account
			// that registered with that address. Require Google's verification.
			if (payload.email_verified !== true) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'GOOGLE_AUTH_FAILED',
					'Google account email is not verified',
				);
			}

			const normalizedEmail = normalizeEmailSafe(payload.email);
			if (!normalizedEmail) {
				return setApiResponse(HTTP.BAD_REQUEST, 'GOOGLE_AUTH_FAILED', 'Invalid email in OAuth response');
			}

			const meta = requestMeta(ctx);

			const upserted = await users.upsertByProvider(normalizedEmail, 'google', payload.sub ?? '');
			if (!upserted) {
				loginEvents.recordSafe({
					userId: null,
					emailAttempted: normalizedEmail,
					method: 'oauth-google',
					outcome: 'failed',
					failureReason: 'provider_upsert_failed',
					...meta,
				});
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'OAuth login failed');
			}

			const fullUser = await users.findById(upserted.id);
			if (!fullUser) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'OAuth login failed');
			}

			const { accessToken, refreshToken, sid } = issueTokenPair(upserted.id, config, {
				loginMethod: 'google',
			});
			await sessions.create(upserted.id, refreshToken, refreshTokenExpiry(refreshToken), sid, meta);
			loginEvents.recordSafe({
				userId: upserted.id,
				emailAttempted: normalizedEmail,
				method: 'oauth-google',
				outcome: 'success',
				...meta,
			});

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
					headers: cookieHeaders([
						...tokenPairCookies(accessToken, refreshToken, config),
						// One-time value — clear it once the flow completes.
						'oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
					]),
				},
			);
		},
	};
}
