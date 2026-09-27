import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createHmac,
	randomBytes,
	scrypt as scryptCb,
	timingSafeEqual,
} from 'node:crypto';

import { constantTimeEqual } from '@fonderie/core';

// Everything an operator sign-in needs, on node:crypto alone. @fonderie/admin
// takes no auth dependency: the operator surface must work in an app that
// never installed @fonderie/auth, and must not share its user tables.

// ── TOTP (RFC 6238, SHA-1, 6 digits, 30 s) ─────────────────────────────────
// The algorithm @fonderie/auth ships, plus a REPLAY GUARD it lacks: the
// matched time-step is returned so the caller can refuse it next time. A code
// read over a shoulder is otherwise good for up to 90 seconds.

const STEP = 30;
const DRIFT = 1;
const DIGITS = 6;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of buf) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += B32[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += B32[(value << (5 - bits)) & 31];
	return out;
}

export function base32Decode(input: string): Buffer {
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const ch of input.toUpperCase().replace(/[=\s]/g, '')) {
		const i = B32.indexOf(ch);
		if (i === -1) continue;
		value = (value << 5) | i;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}

export function hotp(secret: string, counter: number): string {
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(counter));
	const mac = createHmac('sha1', base32Decode(secret)).update(msg).digest();
	const o = (mac[19] ?? 0) & 15;
	const bin =
		(((mac[o] ?? 0) & 0x7f) << 24) |
		(((mac[o + 1] ?? 0) & 255) << 16) |
		(((mac[o + 2] ?? 0) & 255) << 8) |
		((mac[o + 3] ?? 0) & 255);
	return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

export const totpCounter = (now = Date.now()): number => Math.floor(now / 1000 / STEP);

/**
 * The time-step the code matched, or null. A step at or below `lastUsed` is
 * refused even when the code is right — that is the replay guard.
 */
export function verifyTotp(
	secret: string,
	code: string,
	lastUsed: number | null,
	now = Date.now(),
): number | null {
	const clean = code.replace(/\s/g, '');
	if (!/^\d{6}$/.test(clean)) return null;
	const t = totpCounter(now);
	for (let d = -DRIFT; d <= DRIFT; d++) {
		const step = t + d;
		if (lastUsed !== null && step <= lastUsed) continue;
		if (constantTimeEqual(hotp(secret, step), clean)) return step;
	}
	return null;
}

export const newTotpSecret = (): string => base32Encode(randomBytes(20));

export function totpUri(issuer: string, account: string, secret: string): string {
	const q = new URLSearchParams({
		secret,
		issuer,
		algorithm: 'SHA1',
		digits: String(DIGITS),
		period: String(STEP),
	});
	return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${q}`;
}

// ── Backup codes ───────────────────────────────────────────────────────────
// Ten single-use codes, shown once, stored as SHA-256. 10 base32 characters
// (50 bits) each — long enough that the per-account lockout, not the code
// space, is what stops guessing. Grouped for reading: ABCDE-FGHIJ.

export function newBackupCodes(count = 10): string[] {
	return Array.from({ length: count }, () => {
		const s = base32Encode(randomBytes(7)).slice(0, 10);
		return `${s.slice(0, 5)}-${s.slice(5)}`;
	});
}

export const normalizeBackupCode = (code: string): string =>
	code.toUpperCase().replace(/[^A-Z2-7]/g, '');

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

// ── Passwords: scrypt ──────────────────────────────────────────────────────
// Stored as `scrypt$N$r$p$salt$hash` so parameters can be raised later and
// old hashes still verify. N=2^15, r=8 — the OWASP floor for scrypt.

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 32;

const scrypt = (password: string, salt: Buffer, n: number, r: number, p: number) =>
	new Promise<Buffer>((resolve, reject) =>
		scryptCb(
			password.normalize('NFKC'),
			salt,
			KEYLEN,
			{ N: n, r, p, maxmem: 128 * n * r * 2 },
			(err, key) => (err ? reject(err) : resolve(key)),
		),
	);

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scrypt(password, salt, N, R, P);
	return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [kind, n, r, p, salt, hash] = stored.split('$');
	if (kind !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const key = await scrypt(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
	return key.length === expected.length && timingSafeEqual(key, expected);
}

// A hash of nothing, verified against when the email is unknown, so a wrong
// address costs the same time as a wrong password and the response timing
// does not reveal who is an operator.
let dummy: Promise<string> | null = null;
export const dummyHash = (): Promise<string> => {
	dummy ??= hashPassword(randomBytes(16).toString('hex'));
	return dummy;
};

// 12 characters minimum and not trivially guessable. Deliberately no
// composition rules (NIST 800-63B): length is what matters, and the second
// factor is mandatory anyway.
export function passwordProblem(password: unknown): string | null {
	if (typeof password !== 'string' || password.length < 12) return 'Use at least 12 characters.';
	if (password.length > 256) return 'Use at most 256 characters.';
	if (/^(.)\1+$/.test(password)) return 'That password is too easy to guess.';
	return null;
}

// ── TOTP secret at rest ────────────────────────────────────────────────────
// A TOTP secret must stay reversible, so it is encrypted, not hashed, with the
// app's operatorKey (64 hex). Without a key it is stored as-is and readiness
// says so. Same `v1:iv:tag:data` shape as @fonderie/auth's MFA cipher.

const PREFIX = 'op.v1:';

export interface ISecretBox {
	seal(plain: string): string;
	open(stored: string): string;
}

export function secretBox(keyHex: string | undefined): ISecretBox {
	if (!keyHex) return { seal: (p) => p, open: (s) => s };
	const key = Buffer.from(keyHex, 'hex');
	if (key.length !== 32)
		throw new Error('[admin] operatorKey must be 32 bytes — 64 hex chars (`openssl rand -hex 32`)');
	return {
		seal(plain) {
			const iv = randomBytes(12);
			const c = createCipheriv('aes-256-gcm', key, iv);
			const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
			return `${PREFIX}${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${data.toString('hex')}`;
		},
		open(stored) {
			if (!stored.startsWith(PREFIX)) return stored;
			const [iv, tag, data] = stored.slice(PREFIX.length).split(':');
			if (!iv || !tag || !data) throw new Error('[admin] malformed operator secret');
			const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
			d.setAuthTag(Buffer.from(tag, 'hex'));
			return Buffer.concat([d.update(Buffer.from(data, 'hex')), d.final()]).toString('utf8');
		},
	};
}

/** An opaque random credential: a session id or an invite token. */
export const newOpaqueToken = (prefix: string): string =>
	`${prefix}_${randomBytes(32).toString('base64url')}`;
