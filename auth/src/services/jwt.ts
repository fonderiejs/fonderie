import jwt from 'jsonwebtoken';

import type { IAuthConfig } from '../config';

export interface TokenPair {
	accessToken:  string;
	refreshToken: string;
}

export interface IAccessPayload {
	sub:  string;           // userId
	type: 'access';
}

export interface IRefreshPayload {
	sub:  string;
	type: 'refresh';
}

export function issueTokenPair(userId: string, config: IAuthConfig): TokenPair {
	const duration = config.sessionDuration ?? '7d'

	const accessToken = jwt.sign(
		{ sub: userId, type: 'access' } satisfies IAccessPayload,
		config.jwtSecret,
		{ expiresIn: '15m' },
	)

	const refreshToken = jwt.sign(
		{ sub: userId, type: 'refresh' } satisfies IRefreshPayload,
		config.jwtSecret,
		{ expiresIn: duration },
	)

	return { accessToken, refreshToken }
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
