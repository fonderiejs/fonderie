import jwt from 'jsonwebtoken';

import type { IAuthConfig } from '../config';
import { keyIdOf, verifyToken } from './jwt';

// Proof, carried for a few minutes, that the person signing in to an ARCHIVED
// account just passed its credential (password, Google / Apple, phone code).
// It only opens POST /auth/account/restore — its type is not 'access', so the
// session middleware never treats it as a session. Bound to the archive it was
// issued for (deletedAt): an account deleted again needs a fresh proof.

const RESTORE_TTL = '10m';

interface IRestorePayload {
	sub: string;
	type: 'restore';
	loginMethod: 'email' | 'phone' | 'google' | 'apple';
	archivedAt: string;
}

export function issueRestoreToken(
	userId: string,
	deletedAt: Date,
	loginMethod: IRestorePayload['loginMethod'],
	config: IAuthConfig,
): string {
	return jwt.sign(
		{ sub: userId, type: 'restore', loginMethod, archivedAt: deletedAt.toISOString() } satisfies IRestorePayload,
		config.jwtSecret,
		{ expiresIn: RESTORE_TTL, keyid: keyIdOf(config.jwtSecret) },
	);
}

export function verifyRestoreToken(token: string, config: IAuthConfig): IRestorePayload | null {
	const payload = verifyToken(token, config) as unknown as Partial<IRestorePayload> | null;
	if (!payload || payload.type !== 'restore' || typeof payload.sub !== 'string' || typeof payload.archivedAt !== 'string') return null;
	return payload as IRestorePayload;
}
