import { createHash, randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

import type { IAuthConfig } from '../config';

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
}

export interface IRefreshPayload {
	sub: string;
	type: 'refresh';
	loginMethod: 'email' | 'phone' | 'google' | 'apple';
	phoneVerified: boolean;
	sid?: string;
}

export interface ITokenOptions {
	loginMethod: 'email' | 'phone' | 'google' | 'apple';
	phoneVerified?: boolean;
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
	loginMethod: 'email' | 'phone',
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
	const duration = config.sessionDuration ?? '7d';
	const accessDuration = config.accessTokenDuration ?? '24h';
	const loginMethod = options.loginMethod;
	const phoneVerified = options.phoneVerified ?? false;
	const sid = randomUUID();

	const accessToken = jwt.sign(
		{ sub: userId, type: 'access', loginMethod, phoneVerified, sid } satisfies IAccessPayload,
		config.jwtSecret,
		{ expiresIn: accessDuration, keyid: keyIdOf(config.jwtSecret) } as SignOptions,
	);

	const refreshToken = jwt.sign(
		{ sub: userId, type: 'refresh', loginMethod, phoneVerified, sid } satisfies IRefreshPayload,
		config.jwtSecret,
		{ expiresIn: duration, keyid: keyIdOf(config.jwtSecret) } as SignOptions,
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
