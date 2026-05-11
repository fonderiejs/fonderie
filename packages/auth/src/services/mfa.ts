import { createHmac, randomBytes } from 'node:crypto';

// ── TOTP (RFC 6238) — no external dependency ─────────────────────

const STEP    = 30;           // seconds per window
const DRIFT   = 1;            // ±1 window tolerance
const DIGITS  = 6;

function hotp(secret: string, counter: number): string {
	const buf = Buffer.alloc(8);
	let c = counter;

	for (let i = 7; i >= 0; i--) {
		buf[i] = c & 0xff;
		c >>= 8;
	}

	const key  = Buffer.from(base32Decode(secret));
	const hmac = createHmac('sha1', key).update(buf).digest();
	const offset = (hmac[19] ?? 0) & 0x0f;
	const code = (
		((hmac[offset]     ?? 0) & 0x7f) << 24 |
		((hmac[offset + 1] ?? 0) & 0xff) << 16 |
		((hmac[offset + 2] ?? 0) & 0xff) << 8  |
		((hmac[offset + 3] ?? 0) & 0xff)
	) % Math.pow(10, DIGITS);

	return code.toString().padStart(DIGITS, '0');
}

function timeCounter(): number {
	return Math.floor(Date.now() / 1000 / STEP);
}

// RFC 4648 base32 decode — uppercase alphabet only
function base32Decode(input: string): Buffer {
	const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	const clean    = input.toUpperCase().replace(/=+$/, '');
	let bits = 0;
	let value = 0;

	const output: number[] = [];
	for (const char of clean) {
		const idx = ALPHABET.indexOf(char);
		if (idx === -1) {
			continue
		}

		value = (value << 5) | idx;
		bits += 5;

		if (bits >= 8) {
			output.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}

	return Buffer.from(output);
}

function base32Encode(buf: Buffer): string {
	const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = 0;
	let value = 0;
	let output = '';

	for (const byte of buf) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			output += ALPHABET[(value >>> (bits - 5)) & 0x1f];
			bits -= 5;
		}
	}

	if (bits > 0) {
		output += ALPHABET[(value << (5 - bits)) & 0x1f];
	}

	return output;
}

// ── Public API ────────────────────────────────────────────────────

export function generateTotpSecret(): string {
	return base32Encode(randomBytes(20));
}

export function generateTotpUri(email: string, secret: string, issuer: string): string {
	const params = new URLSearchParams({
		secret,
		issuer,
		algorithm: 'SHA1',
		digits:    String(DIGITS),
		period:    String(STEP),
	});

	return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?${params}`;
}

export function verifyTotpToken(token: string, secret: string): boolean {
	const t = timeCounter();
	for (let i = -DRIFT; i <= DRIFT; i++) {
		if (hotp(secret, t + i) === token) {
			return true;
		}
	}

	return false;
}

export function generateTotpCode(secret: string): string {
	return hotp(secret, timeCounter());
}

export function generateBackupCodes(count = 8): string[] {
	return Array.from({ length: count }, () =>
		randomBytes(4).toString('hex').toUpperCase()
	);
}
