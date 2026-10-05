import type { IStoreAdapter } from '@fonderie/store';

import type { IAuthConfig } from '../config';
import { BackupCodeModel } from '../models/backup-code.model';
import { UserModel } from '../models/user.model';
import { verifyTotpToken } from './mfa';
import { makeMfaCipher } from './mfa-crypto';
import { verifyPassword } from './password';

/**
 * Check a second factor for a sensitive action outside the login flow
 * (confirming or cancelling an account deletion): a 6-digit TOTP from the
 * person's authenticator, or one of their 8-character backup codes (spent on
 * use, as at sign-in). Works for an archived account too.
 */
export async function verifySecondFactor(
	store: IStoreAdapter,
	config: IAuthConfig,
	userId: string,
	code: unknown,
): Promise<boolean> {
	if (typeof code !== 'string') return false;
	const value = code.trim();
	if (/^\d{6}$/.test(value)) {
		const stored = await new UserModel(store).getMfaSecret(userId);
		if (!stored) return false;
		return verifyTotpToken(value, makeMfaCipher(config.mfaSecretKey).decrypt(stored));
	}
	if (/^[A-Z0-9]{8}$/i.test(value)) {
		const backupCodes = new BackupCodeModel(store);
		for (const row of await backupCodes.findUnused(userId)) {
			if (await verifyPassword(value.toUpperCase(), row.codeHash)) {
				// Spent atomically: a concurrent request with the same code loses.
				return backupCodes.consume(row.id);
			}
		}
	}
	return false;
}
