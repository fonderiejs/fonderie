import { createHash } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

// The one-time code that confirms an account deletion. Only its hash is stored
// (as for password resets); five wrong tries spend it.
const hashCode = (code: string): string => createHash('sha256').update(code).digest('hex');

export const DELETION_CODE_MAX_ATTEMPTS = 5;

export type DeletionChannel = 'email' | 'sms';

export type DeletionCodeCheck = 'ok' | 'invalid' | 'expired' | 'exhausted' | 'none';

export class AccountDeletionModel {
	constructor(private store: IStoreAdapter) {}

	/** Replace any pending code (a new request supersedes the old one). */
	async saveCode(userId: string, code: string, channel: DeletionChannel, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_account_deletion_codes (user_id, code_hash, channel, attempts, expires_at, created_at)
			 VALUES ($1, $2, $3, 0, $4, now())
			 ON CONFLICT (user_id) DO UPDATE
			 SET code_hash = $2, channel = $3, attempts = 0, expires_at = $4, created_at = now()`,
			[userId, hashCode(code), channel, expiresAt],
		);
	}

	async lastSentAt(userId: string): Promise<Date | null> {
		const [row] = await this.store.query<{ createdAt: Date }>(
			`SELECT created_at AS "createdAt" FROM fonderie_account_deletion_codes WHERE user_id = $1`,
			[userId],
		);
		return row ? new Date(row.createdAt) : null;
	}

	/**
	 * Check a code in ONE statement: a wrong code spends an attempt, a right
	 * one is consumed (deleted) — so a code is good once, and a guesser gets
	 * five tries in total however many requests they race.
	 */
	async checkCode(userId: string, code: string): Promise<{ result: DeletionCodeCheck; channel?: DeletionChannel }> {
		const [row] = await this.store.query<{ matched: boolean; expired: boolean; attempts: number; channel: DeletionChannel }>(
			`WITH current AS (
			   SELECT user_id, code_hash = $2 AS matched, expires_at <= now() AS expired, attempts, channel
			   FROM fonderie_account_deletion_codes WHERE user_id = $1
			   FOR UPDATE
			 ), spent AS (
			   DELETE FROM fonderie_account_deletion_codes d USING current c
			   WHERE d.user_id = c.user_id AND c.matched AND NOT c.expired AND c.attempts < $3
			 ), missed AS (
			   UPDATE fonderie_account_deletion_codes d SET attempts = d.attempts + 1
			   FROM current c
			   WHERE d.user_id = c.user_id AND NOT (c.matched AND NOT c.expired AND c.attempts < $3)
			 )
			 SELECT matched, expired, attempts, channel FROM current`,
			[userId, hashCode(code), DELETION_CODE_MAX_ATTEMPTS],
		);
		if (!row) return { result: 'none' };
		if (row.attempts >= DELETION_CODE_MAX_ATTEMPTS) return { result: 'exhausted' };
		if (row.expired) return { result: 'expired' };
		return { result: row.matched ? 'ok' : 'invalid', channel: row.channel };
	}
}
