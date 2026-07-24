import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
	return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plain, hash);
}

export interface IVerifyResult {
	valid: boolean;
	// True when the password validated only via the legacy verifier — the caller
	// should re-store it as a bcrypt hash (rehash-on-login).
	needsRehash: boolean;
}

// The login-path verifier: `verifyPassword` (the bcrypt primitive) PLUS an
// optional foreign-hash fallback for apps migrating onto Fonderie auth. Tries
// bcrypt first; if that fails and a `legacyVerify` is provided, falls back to it
// and flags `needsRehash` so the caller can re-store the password as bcrypt
// (rehash-on-login). `bcrypt.compare` returns false rather than throwing on a
// non-bcrypt hash, so the fallback is reached cleanly; the legacy verifier is
// wrapped defensively in case a custom implementation throws.
export async function verifyPasswordWithLegacy(
	plain: string,
	hash: string,
	legacyVerify?: (plain: string, hash: string) => boolean | Promise<boolean>,
): Promise<IVerifyResult> {
	if (await verifyPassword(plain, hash)) return { valid: true, needsRehash: false };

	if (legacyVerify) {
		let legacyOk = false;
		try {
			legacyOk = await legacyVerify(plain, hash);
		} catch {
			legacyOk = false;
		}
		if (legacyOk) return { valid: true, needsRehash: true };
	}

	return { valid: false, needsRehash: false };
}
