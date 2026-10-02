import { createHash, randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { DEFAULT_ACCESS_TOKEN_DURATION, DEFAULT_SESSION_DURATION, type IAuthConfig } from '../config';

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	// Server-side session id both tokens are bound to. Store it on the
	// fonderie_sessions row — deleting that row revokes the access token
	// immediately, not just the refresh token.
	sid: string;
}

export interface IAccessPayload {
	sub: string; // userId
	type: 'access';
	loginMethod: 'email' | 'phone' | 'google' | 'apple';
	phoneVerified: boolean;
	mfaPending?: boolean;
	// Absent only on legacy tokens issued before session binding and on
	// short-lived mfaPending tokens (no session exists yet at that point).
	sid?: string;
	// When the user last actually signed in (seconds). Absent on tokens issued
	// before Phase 3.
	auth_time?: number;
}

export interface IRefreshPayload {
	sub: string;
	type: 'refresh';
	loginMethod: 'email' | 'phone' | 'google' | 'apple';
	phoneVerified: boolean;
	sid?: string;
	auth_time?: number;
}

export interface ITokenOptions {
	loginMethod: 'email' | 'phone' | 'google' | 'apple';
	phoneVerified?: boolean;
	// Keep an existing session id (a refresh rotates the same device session);
	// absent ⇒ a new session.
	sid?: string;
	// The original sign-in time (seconds since epoch) to carry through a
	// refresh; absent ⇒ now (this IS a sign-in).
	authTime?: number;
}

// ── Key ring ──────────────────────────────────────────────────────────────
// Tokens are signed with the CURRENT secret and carry its key id (`kid`).
// Verification picks the secret by kid among [jwtSecret, ...jwtPreviousSecrets],
// so rotating the secret signs nobody out: move the old one to
// jwtPreviousSecrets, deploy, and drop it once the longest-lived token signed
// with it has expired. The kid is derived from the secret — stable, no extra
// config, and a truncated hash reveals nothing usable.
export function keyIdOf(secret: string): string {
	return createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

function keyRing(config: IAuthConfig): string[] {
	return [config.jwtSecret, ...(config.jwtPreviousSecrets ?? [])].filter((s): s is string => typeof s === 'string' && s.length > 0);
}

export function issueMfaPendingToken(
	userId: string,
	config: IAuthConfig,
	loginMethod: 'email' | 'phone' | 'google' | 'apple',
): string {
	return jwt.sign(
		{
			sub: userId,
			type: 'access',
			loginMethod,
			phoneVerified: false,
			mfaPending: true,
		} satisfies IAccessPayload,
		config.jwtSecret,
		{ expiresIn: '5m', keyid: keyIdOf(config.jwtSecret) },
	);
}

export function issueTokenPair(
	userId: string,
	config: IAuthConfig,
	options: ITokenOptions,
): TokenPair {
	// Lifetimes may come from an app's runtime resolver (console values). An
	// unreadable one — e.g. the text "undefined" from String(undefined) — must
	// fall back, not make jsonwebtoken throw on every sign-in and refresh.
	const duration = validDuration(config.sessionDuration, DEFAULT_SESSION_DURATION, 'sessionDuration');
	const accessDuration = validDuration(config.accessTokenDuration, DEFAULT_ACCESS_TOKEN_DURATION, 'accessTokenDuration');
	// When the user last actually signed in (seconds): a refresh carries it, a
	// sign-in sets it. Step-up ("re-authenticate for sensitive actions") reads it.
	const authTime = options.authTime ?? Math.floor(Date.now() / 1000);
	const loginMethod = options.loginMethod;
	const phoneVerified = options.phoneVerified ?? false;
	const sid = options.sid ?? randomUUID();

	const accessToken = jwt.sign(
		{ sub: userId, type: 'access', loginMethod, phoneVerified, sid, auth_time: authTime } satisfies IAccessPayload,
		config.jwtSecret,
		// jwtid: every token is unique. With the session id kept across rotations,
		// two tokens issued in the same second would otherwise be byte-identical —
		// and a rotated-away token indistinguishable from the live one.
		{ expiresIn: accessDuration, keyid: keyIdOf(config.jwtSecret), jwtid: randomUUID() } as SignOptions,
	);

	const refreshToken = jwt.sign(
		{ sub: userId, type: 'refresh', loginMethod, phoneVerified, sid, auth_time: authTime } satisfies IRefreshPayload,
		config.jwtSecret,
		{ expiresIn: duration, keyid: keyIdOf(config.jwtSecret), jwtid: randomUUID() } as SignOptions,
	);

	return { accessToken, refreshToken, sid };
}

export function refreshTokenExpiry(token: string): Date {
	const decoded = jwt.decode(token) as { exp?: number } | null;
	return decoded?.exp
		? new Date(decoded.exp * 1000)
		: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

export function verifyToken(
	token: string,
	config: IAuthConfig,
): IAccessPayload | IRefreshPayload | null {
	const ring = keyRing(config);
	const kid = (jwt.decode(token, { complete: true }) as { header?: { kid?: unknown } } | null)?.header?.kid;
	// A kid names exactly one secret; a token without one (signed before key
	// ids) is tried against each. An unknown kid verifies against nothing.
	const candidates = typeof kid === 'string' ? ring.filter((s) => keyIdOf(s) === kid) : ring;
	for (const secret of candidates) {
		try {
			return jwt.verify(token, secret) as IAccessPayload | IRefreshPayload;
		} catch {
			// wrong key, bad signature or expired — try the next candidate
		}
	}
	return null;
}

/** A jsonwebtoken-style duration ('90d', '12h', '30m', '45s', '2w', '1y') in ms; null if unreadable. */
export function durationMs(value: string | undefined): number | null {
	const m = /^\s*(\d+)\s*(ms|s|m|h|d|w|y)?\s*$/i.exec(value ?? '');
	if (!m) return null;
	const unit = (m[2] ?? 's').toLowerCase();
	const scale: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, y: 31_557_6e5 };
	return Number(m[1]) * (scale[unit] ?? 1e3);
}

const warnedDurations = new Set<string>();
function validDuration(value: string | undefined, fallback: string, name: string): string {
	if (value === undefined || value === null || value === '') return fallback;
	if (durationMs(String(value)) !== null) return String(value);
	const key = `${name}=${String(value)}`;
	if (!warnedDurations.has(key)) {
		warnedDurations.add(key);
		console.warn(`[auth] ${name} ${JSON.stringify(value)} is not a duration (e.g. '90d', '1h') — using ${fallback}`);
	}
	return fallback;
}
