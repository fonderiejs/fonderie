import { randomBytes, createPublicKey, createHash, type KeyObject } from 'node:crypto';
import jwt from 'jsonwebtoken';

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
import { ConsumedTokenModel } from '../models/consumed-token.model';
import { requestMeta } from '../services/request-meta';
import { normalizeEmailSafe } from '../services/email';

// ── Sign in with Apple ───────────────────────────────────────────────────────
// Apple differs from Google in three ways handled here: (1) the client secret
// is a short-lived ES256 JWT minted from the .p8 key, not a static string;
// (2) the web callback is a cross-site POST (response_mode=form_post), so its
// CSRF cookie must be SameSite=None; (3) the NATIVE identityToken (from the iOS
// sheet) did not come from our own TLS exchange, so its signature MUST be
// verified against Apple's published JWKS.

const APPLE_AUTH_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

type AppleConfig = NonNullable<IAuthConfig['apple']>;

interface AppleClaims {
	email?: string;
	sub?: string;
	// Apple sends email_verified as a boolean OR the string "true".
	email_verified?: boolean | string;
	nonce?: string;
	// Seconds since epoch — the token's own expiry, used as the TTL of the
	// single-use replay record.
	exp?: number;
}

// Mint the client_secret: a ≤5-min ES256 JWT signed with the .p8 key. Minted
// per exchange and never stored (Apple allows up to 6 months; short is safer).
export function mintAppleClientSecret(apple: AppleConfig): string {
	const now = Math.floor(Date.now() / 1000);
	return jwt.sign(
		{ iss: apple.teamId, iat: now, exp: now + 300, aud: APPLE_ISSUER, sub: apple.clientId },
		apple.privateKey,
		{ algorithm: 'ES256', keyid: apple.keyId },
	);
}

// Apple's signing keys, cached for an hour. Module-level cache is safe: the keys
// are public. Hardened against unknown-kid abuse: an attacker fully controls the
// (unverified) kid on POST /auth/apple/native, and a naive "refetch on unknown
// kid" turns every forged token into an outbound call to Apple. So refetches are
// (a) single-flighted — concurrent callers share one fetch, (b) rate-limited to
// at most one attempt per minute regardless of how many unknown kids arrive, and
// (c) bounded by a request timeout so a slow/hung Apple never ties up handlers.
interface AppleJwk { kid: string; kty: string; n: string; e: string; alg: string; use?: string }
let appleKeyCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;
let appleKeyInflight: Promise<void> | null = null;
let appleKeyLastAttempt = 0;
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000;
const APPLE_KEYS_MIN_REFETCH_MS = 60 * 1000;
const APPLE_KEYS_FETCH_TIMEOUT_MS = 5000;

function refreshAppleKeys(): Promise<void> {
	// Single-flight: one in-flight fetch is shared by all concurrent callers.
	if (appleKeyInflight) return appleKeyInflight;
	appleKeyLastAttempt = Date.now();
	appleKeyInflight = (async () => {
		try {
			const res = await fetch(APPLE_KEYS_URL, { signal: AbortSignal.timeout(APPLE_KEYS_FETCH_TIMEOUT_MS) });
			const data = (await res.json()) as { keys?: AppleJwk[] };
			if (Array.isArray(data.keys)) appleKeyCache = { keys: data.keys, fetchedAt: Date.now() };
		} catch {
			// Keep any stale cache rather than failing outright.
		} finally {
			appleKeyInflight = null;
		}
	})();
	return appleKeyInflight;
}

async function getApplePublicKey(kid: string): Promise<KeyObject | null> {
	const find = () => appleKeyCache?.keys.find((k) => k.kid === kid) ?? null;
	const cacheFresh = () => !!appleKeyCache && Date.now() - appleKeyCache.fetchedAt < APPLE_KEYS_TTL_MS;

	let jwk = find();
	// Refetch only when the kid is missing or the cache is stale — AND not more
	// than once per minute, so a flood of attacker-chosen kids can trigger at
	// most one outbound fetch per minute, never one per request.
	if ((!jwk || !cacheFresh()) && Date.now() - appleKeyLastAttempt >= APPLE_KEYS_MIN_REFETCH_MS) {
		await refreshAppleKeys();
		jwk = find();
	}
	if (!jwk) return null;
	try {
		return createPublicKey({ key: jwk as unknown as JsonWebKey, format: 'jwk' });
	} catch {
		return null;
	}
}

// Verify an Apple id_token: signature against the JWKS (by kid), issuer, and
// audience (Services ID for web; allow-listed bundle ids for native). exp is
// enforced by jwt.verify. Returns the claims, or null on any failure.
export async function verifyAppleIdToken(
	idToken: string,
	opts: { audiences: string[]; nonce?: string | undefined },
): Promise<AppleClaims | null> {
	if (opts.audiences.length === 0) return null;
	const decoded = jwt.decode(idToken, { complete: true });
	if (!decoded || typeof decoded === 'string') return null;
	const kid = decoded.header.kid;
	if (!kid) return null;
	const key = await getApplePublicKey(kid);
	if (!key) return null;
	try {
		const payload = jwt.verify(idToken, key, {
			algorithms: ['RS256'],
			issuer: APPLE_ISSUER,
			// jsonwebtoken types `audience` as a non-empty tuple; runtime accepts a
			// list and matches the token's aud against ANY entry (guarded non-empty
			// above).
			audience: opts.audiences as [string, ...string[]],
		}) as AppleClaims;
		// Optional session-binding: if the app bound a nonce to the native
		// request, the token's nonce claim must match it (defends against a token
		// substituted from a different session). This is NOT replay protection —
		// verbatim replay is stopped by the single-use guard in appleNative.
		if (opts.nonce !== undefined && payload.nonce !== opts.nonce) return null;
		return payload;
	} catch {
		return null;
	}
}

const appleEmailVerified = (c: AppleClaims): boolean =>
	c.email_verified === true || c.email_verified === 'true';

// Test-only: reset the module-level JWKS cache/rate-limit state so each test can
// exercise a fresh fetch. Never called in production code paths.
export function __resetAppleKeysForTests(): void {
	appleKeyCache = null;
	appleKeyInflight = null;
	appleKeyLastAttempt = 0;
}

export function oauthController(store: IStoreAdapter, config: IAuthConfig) {
	const users = new UserModel(store);
	const sessions = new SessionModel(store);
	const loginEvents = new LoginEventModel(store);
	const consumedTokens = new ConsumedTokenModel(store);

	// Shared tail for both Apple flows (web callback + native token): given
	// verified claims, upsert the account by email, open a session, record the
	// login event, and return the same token/user envelope the Google flow does.
	const completeAppleLogin = async (
		ctx: IFonderieContext,
		claims: { email?: string | undefined; sub?: string | undefined; emailVerified: boolean },
	): Promise<Response> => {
		const meta = requestMeta(ctx);
		if (!claims.email) {
			return setApiResponse(HTTP.BAD_REQUEST, 'APPLE_AUTH_FAILED', 'No email in Apple identity token');
		}
		// Linking is BY EMAIL — an unverified address would let its holder take
		// over an account registered with it. Apple verifies both real and
		// private-relay addresses; require it.
		if (!claims.emailVerified) {
			return setApiResponse(HTTP.BAD_REQUEST, 'APPLE_AUTH_FAILED', 'Apple account email is not verified');
		}
		const normalizedEmail = normalizeEmailSafe(claims.email);
		if (!normalizedEmail) {
			return setApiResponse(HTTP.BAD_REQUEST, 'APPLE_AUTH_FAILED', 'Invalid email in Apple identity token');
		}

		const upserted = await users.upsertByProvider(normalizedEmail, 'apple', claims.sub ?? '');
		if (!upserted) {
			loginEvents.recordSafe({
				userId: null,
				emailAttempted: normalizedEmail,
				method: 'oauth-apple',
				outcome: 'failed',
				failureReason: 'provider_upsert_failed',
				...meta,
			});
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Apple login failed');
		}

		const fullUser = await users.findById(upserted.id);
		if (!fullUser) {
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Apple login failed');
		}

		const { accessToken, refreshToken, sid } = issueTokenPair(upserted.id, config, { loginMethod: 'apple' });
		await sessions.create(upserted.id, refreshToken, refreshTokenExpiry(refreshToken), sid, meta);
		loginEvents.recordSafe({
			userId: upserted.id,
			emailAttempted: normalizedEmail,
			method: 'oauth-apple',
			outcome: 'success',
			...meta,
		});

		return Response.json(
			{
				reason: 'APPLE_AUTH_SUCCESS',
				explanation: 'Apple authentication successful.',
				result: {
					tokens: { access: accessToken, refresh: refreshToken },
					user: toUserDTO(fullUser),
				},
			},
			{
				status: 200,
				headers: cookieHeaders([
					...tokenPairCookies(accessToken, refreshToken, config),
					// One-time value — clear the (SameSite=None) state cookie.
					'oauth_state=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0',
				]),
			},
		);
	};

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

		appleInit: async (_ctx: IFonderieContext): Promise<Response> => {
			const apple = config.apple;
			if (!apple) {
				return setApiResponse(HTTP.NOT_IMPLEMENTED, 'NOT_CONFIGURED', 'Apple OAuth not configured');
			}

			const state = randomBytes(16).toString('hex');
			const params = new URLSearchParams({
				client_id: apple.clientId,
				redirect_uri: apple.redirectUri,
				response_type: 'code',
				// form_post is REQUIRED to receive name/email; Apple then POSTs the
				// callback cross-site.
				response_mode: 'form_post',
				scope: 'name email',
				state,
			});
			const url = `${APPLE_AUTH_URL}?${params}`;

			// SameSite=None; Secure (NOT Lax like Google): the state cookie must
			// survive Apple's cross-site POST back to the callback. Requires HTTPS,
			// which Sign in with Apple mandates for redirect URIs anyway.
			return Response.json(
				{
					reason: 'APPLE_AUTH_URL',
					explanation: 'Redirect the user to the returned URL to begin Apple OAuth.',
					result: { url },
				},
				{
					status: 200,
					headers: cookieHeaders([
						`oauth_state=${state}; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=600`,
					]),
				},
			);
		},

		appleCallback: async (ctx: IFonderieContext): Promise<Response> => {
			const apple = config.apple;
			if (!apple) {
				return setApiResponse(HTTP.NOT_IMPLEMENTED, 'NOT_CONFIGURED', 'Apple OAuth not configured');
			}

			// Apple posts application/x-www-form-urlencoded (response_mode=form_post).
			// Prefer a pre-parsed body if the pipeline produced one, else read raw.
			const pre = ctx.meta['body'];
			const form =
				pre && typeof pre === 'object'
					? new URLSearchParams(pre as Record<string, string>)
					: new URLSearchParams(await ctx.request.text());

			const code = form.get('code');
			if (!code) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Missing code');
			}

			// CSRF: the state Apple echoes must equal the value appleInit bound to
			// this browser via cookie.
			const returnedState = form.get('state') ?? '';
			const cookieHeader = ctx.request.headers.get('cookie') ?? '';
			const expectedState = cookieHeader.match(/(?:^|;\s*)oauth_state=([^;]+)/)?.[1] ?? '';
			if (
				!returnedState ||
				!expectedState ||
				!constantTimeEqual(Buffer.from(returnedState), Buffer.from(expectedState))
			) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'APPLE_AUTH_FAILED',
					'OAuth state mismatch — restart the sign-in flow',
				);
			}

			const tokenRes = await fetch(APPLE_TOKEN_URL, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					code,
					client_id: apple.clientId,
					client_secret: mintAppleClientSecret(apple),
					redirect_uri: apple.redirectUri,
					grant_type: 'authorization_code',
				}),
			});
			const tokenData = (await tokenRes.json()) as { id_token?: string };
			if (!tokenData.id_token) {
				return setApiResponse(HTTP.BAD_REQUEST, 'APPLE_AUTH_FAILED', 'OAuth token exchange failed');
			}

			// Web audience is the Services ID. Full JWKS signature check (one shared
			// verifier for both flows; stronger than skipping it).
			const claims = await verifyAppleIdToken(tokenData.id_token, { audiences: [apple.clientId] });
			if (!claims) {
				return setApiResponse(HTTP.BAD_REQUEST, 'APPLE_AUTH_FAILED', 'Invalid Apple identity token');
			}
			return completeAppleLogin(ctx, {
				email: claims.email,
				sub: claims.sub,
				emailVerified: appleEmailVerified(claims),
			});
		},

		appleNative: async (ctx: IFonderieContext): Promise<Response> => {
			const apple = config.apple;
			if (!apple) {
				return setApiResponse(HTTP.NOT_IMPLEMENTED, 'NOT_CONFIGURED', 'Apple OAuth not configured');
			}
			const body = ctx.meta['body'] as { identityToken?: string; nonce?: string } | undefined;
			const identityToken = body?.identityToken;
			if (!identityToken) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_PARAMETER', 'Missing identityToken');
			}

			// Native identityTokens carry aud = the app's bundle id (allow-listed
			// via nativeClientIds), not the Services ID, and did NOT come from our
			// TLS exchange — so verifyAppleIdToken's JWKS signature check is the
			// only thing between a forged token and a login.
			const audiences =
				apple.nativeClientIds && apple.nativeClientIds.length
					? apple.nativeClientIds
					: [apple.clientId];
			const claims = await verifyAppleIdToken(identityToken, { audiences, nonce: body?.nonce });
			if (!claims) {
				const meta = requestMeta(ctx);
				loginEvents.recordSafe({
					userId: null,
					emailAttempted: null,
					method: 'oauth-apple',
					outcome: 'failed',
					failureReason: 'invalid_identity_token',
					...meta,
				});
				return setApiResponse(HTTP.UNAUTHORIZED, 'APPLE_AUTH_FAILED', 'Invalid Apple identity token');
			}

			// Single-use guard: a verified native identityToken may be redeemed
			// exactly once. Apple does not one-time it for us (unlike the web `code`
			// exchange), so without this a captured token could be replayed until
			// its exp. Consume by hash with TTL = the token's exp; a replay is a
			// recorded security event, never a login.
			const tokenHash = createHash('sha256').update(identityToken).digest('hex');
			const expMs = typeof claims.exp === 'number' ? claims.exp * 1000 : Date.now() + 5 * 60 * 1000;
			const firstUse = await consumedTokens.consumeOnce(tokenHash, new Date(expMs));
			if (!firstUse) {
				const meta = requestMeta(ctx);
				loginEvents.recordSafe({
					userId: null,
					emailAttempted: claims.email ?? null,
					method: 'oauth-apple',
					outcome: 'failed',
					failureReason: 'token_replayed',
					...meta,
				});
				return setApiResponse(
					HTTP.UNAUTHORIZED,
					'APPLE_AUTH_FAILED',
					'This Apple identity token has already been used',
				);
			}
			consumedTokens.sweepExpiredSafe();

			return completeAppleLogin(ctx, {
				email: claims.email,
				sub: claims.sub,
				emailVerified: appleEmailVerified(claims),
			});
		},
	};
}
