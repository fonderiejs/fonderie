import jwt, { type SignOptions } from 'jsonwebtoken';

import type { IAuthConfig } from '../config';

export interface TokenPair {
	accessToken:  string;
	refreshToken: string;
}

export interface IAccessPayload {
	sub:           string;  // userId
	type:          'access';
	loginMethod:   'email' | 'phone';
	phoneVerified: boolean;
}

export interface IRefreshPayload {
	sub:           string;
	type:          'refresh';
	loginMethod:   'email' | 'phone';
	phoneVerified: boolean;
}

export interface ITokenOptions {
	loginMethod:    'email' | 'phone';
	phoneVerified?: boolean;
}

export function issueTokenPair(userId: string, config: IAuthConfig, options: ITokenOptions): TokenPair {
	const duration      = config.sessionDuration ?? '7d'
	const loginMethod   = options.loginMethod
	const phoneVerified = options.phoneVerified ?? false

	const accessToken = jwt.sign(
		{ sub: userId, type: 'access', loginMethod, phoneVerified } satisfies IAccessPayload,
		config.jwtSecret,
		{ expiresIn: '15m' },
	)

	const refreshToken = jwt.sign(
		{ sub: userId, type: 'refresh', loginMethod, phoneVerified } satisfies IRefreshPayload,
		config.jwtSecret,
		{ expiresIn: duration } as SignOptions,
	)

	return { accessToken, refreshToken }
}

export function refreshTokenExpiry(token: string): Date {
	const decoded = jwt.decode(token) as { exp?: number } | null
	return decoded?.exp
		? new Date(decoded.exp * 1000)
		: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
}

export function verifyToken(
	token: string,
	config: IAuthConfig,
): IAccessPayload | IRefreshPayload | null {
	try {
		return jwt.verify(token, config.jwtSecret) as IAccessPayload | IRefreshPayload
	} catch {
		return null
	}
}
