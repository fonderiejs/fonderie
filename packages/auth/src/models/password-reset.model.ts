import { createHash } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

// Store only a hash of the reset credentials — never the plaintext. A DB read
// (SQLi elsewhere, a backup/log leak) then yields nothing directly usable
// within the 1h window. SHA-256 is sufficient: the token carries 256 bits of
// entropy (unguessable), and the 6-digit pin's real protection is the route
// rate-limiter + short TTL + all-session-revoke, not the hash. Deterministic
// (unsalted) so the lookup is a single indexed equality on the hash.
const hashSecret = (value: string): string => createHash('sha256').update(value).digest('hex');

export class PasswordResetModel {
	constructor(private store: IStoreAdapter) {}

	async create(userId: string, pin: string, token: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_password_resets (user_id, pin, token, expires_at, created_at)
			VALUES ($1, $2, $3, $4, now())
			ON CONFLICT (user_id) DO UPDATE
			SET pin = $2, token = $3, expires_at = $4, created_at = now()`,
			[userId, hashSecret(pin), hashSecret(token), expiresAt],
		);
	}

	async findLastSentAt(userId: string): Promise<Date | null> {
		const [row] = await this.store.query<{ created_at: Date }>(
			`SELECT created_at FROM fonderie_password_resets WHERE user_id = $1`,
			[userId],
		);
		if (!row) return null;
		return new Date(row.created_at);
	}

	async findByPin(pin: string): Promise<{ userId: string; expiresAt: Date } | null> {
		const [row] = await this.store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_password_resets WHERE pin = $1`,
			[hashSecret(pin)],
		);
		if (!row) return null;
		return { userId: row.user_id, expiresAt: new Date(row.expires_at) };
	}

	// Lookup by the high-entropy reset token. Unlike the 6-digit pin this is
	// not brute-forceable, so the token path needs no rate limit. Empty/short
	// values are refused before the query so a NULL/blank token column can
	// never be matched.
	async findByToken(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
		if (typeof token !== 'string' || token.length < 32) return null;
		const [row] = await this.store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_password_resets WHERE token = $1`,
			[hashSecret(token)],
		);
		if (!row) return null;
		return { userId: row.user_id, expiresAt: new Date(row.expires_at) };
	}

	async deleteByUser(userId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_password_resets WHERE user_id = $1`, [userId]);
	}
}
