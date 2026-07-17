import { randomUUID } from 'node:crypto';
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
	loginMethod: 'email' | 'phone' | 'google';
	phoneVerified: boolean;
	mfaPending?: boolean;
	// Absent only on legacy tokens issued before session binding and on
	// short-lived mfaPending tokens (no session exists yet at that point).
	sid?: string;
}

export interface IRefreshPayload {
	sub: string;
	type: 'refresh';
	loginMethod: 'email' | 'phone' | 'google';
	phoneVerified: boolean;
	sid?: string;
}

export interface ITokenOptions {
	loginMethod: 'email' | 'phone' | 'google';
	phoneVerified?: boolean;
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
		{ expiresIn: '5m' },
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
		{ expiresIn: accessDuration } as SignOptions,
	);

	const refreshToken = jwt.sign(
		{ sub: userId, type: 'refresh', loginMethod, phoneVerified, sid } satisfies IRefreshPayload,
		config.jwtSecret,
		{ expiresIn: duration } as SignOptions,
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
	try {
		return jwt.verify(token, config.jwtSecret) as IAccessPayload | IRefreshPayload;
	} catch {
		return null;
	}
}
