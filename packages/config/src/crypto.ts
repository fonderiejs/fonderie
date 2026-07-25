import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Pluggable at-rest encryption for secrets. The store only ever sees the output
// of `encrypt`; the reveal path calls `decrypt`. Bring your own (KMS-backed) or
// use the built-ins below.
export interface ISecretEncryptor {
	encrypt(plain: string): string;
	decrypt(cipher: string): string;
}

// Default: no encryption. Secrets are still masked in admin reads and isolated
// in their own table/authz — but plaintext at rest. Configure a real encryptor
// (`createAesGcmEncryptor`) for a production deployment.
export const noopEncryptor: ISecretEncryptor = {
	encrypt: (plain) => plain,
	decrypt: (cipher) => cipher,
};

// AES-256-GCM. `key` is 32 bytes as a 64-char hex string (e.g.
// `openssl rand -hex 32`). Output is `iv:tag:ciphertext`, all hex. Authenticated
// (tampering is detected on decrypt).
export function createAesGcmEncryptor(keyHex: string): ISecretEncryptor {
	const key = Buffer.from(keyHex, 'hex');
	if (key.length !== 32) {
		throw new Error('[config] secret encryptor key must be 32 bytes (64 hex chars)');
	}
	return {
		encrypt(plain) {
			const iv = randomBytes(12);
			const cipher = createCipheriv('aes-256-gcm', key, iv);
			const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
			const tag = cipher.getAuthTag();
			return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
		},
		decrypt(cipher) {
			const [ivHex, tagHex, dataHex] = cipher.split(':');
			if (!ivHex || !tagHex || !dataHex) {
				throw new Error('[config] malformed secret ciphertext');
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
