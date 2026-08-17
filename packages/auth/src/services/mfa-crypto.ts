import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// At-rest encryption for TOTP secrets. Unlike passwords, a TOTP secret must stay
// reversible (the server recomputes codes from it), so it can't be hashed — it's
// encrypted with a key the app holds instead. AES-256-GCM; output is
// `mfa.v1:iv:tag:ciphertext`, all hex. Authenticated (tampering fails on decrypt).
//
// Backward compatible by design:
//   - No key configured → passthrough. Secrets are stored plaintext exactly as
//     before this change, so upgrading without a key is a no-op.
//   - With a key, `decrypt` still passes through any value lacking the `mfa.v1:`
//     prefix, so pre-existing plaintext secrets keep working and are re-encrypted
//     the next time the user re-runs MFA setup (lazy migration). A base32 TOTP
//     secret never starts with the prefix, so the two are unambiguous.
const PREFIX = 'mfa.v1:';

export interface IMfaCipher {
	encrypt(plain: string): string;
	decrypt(stored: string): string;
}

export function makeMfaCipher(keyHex?: string): IMfaCipher {
	if (!keyHex) {
		// Passthrough: no key, no encryption. `decrypt` is identity — a legacy
		// plaintext secret returns unchanged; a prefixed value (written when a key
		// was previously set, now removed) can't be recovered and will simply fail
		// TOTP verification, which is the correct outcome for a lost key.
		return { encrypt: (plain) => plain, decrypt: (stored) => stored };
	}

	const key = Buffer.from(keyHex, 'hex');
	if (key.length !== 32) {
		throw new Error('[auth] mfaSecretKey must be 32 bytes (64 hex chars, e.g. `openssl rand -hex 32`)');
	}

	return {
		encrypt(plain) {
			const iv = randomBytes(12);
			const cipher = createCipheriv('aes-256-gcm', key, iv);
			const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
			const tag = cipher.getAuthTag();
			return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
		},
		decrypt(stored) {
			if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext — pass through
			const [ivHex, tagHex, dataHex] = stored.slice(PREFIX.length).split(':');
			if (!ivHex || !tagHex || !dataHex) {
				throw new Error('[auth] malformed mfa secret ciphertext');
			}
			const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
			decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
			return Buffer.concat([
				decipher.update(Buffer.from(dataHex, 'hex')),
				decipher.final(),
			]).toString('utf8');
		},
	};
}
