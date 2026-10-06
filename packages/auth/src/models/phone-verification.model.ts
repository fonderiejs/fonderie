import type { IStoreAdapter } from '@fonderie/store';

/** Wrong tries a phone code survives. */
export const PHONE_OTP_MAX_ATTEMPTS = 5;

export class PhoneVerificationModel {
	constructor(private store: IStoreAdapter) {}

	async upsert(userId: string, phone: string, otp: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_phone_verifications (phone, user_id, otp, expires_at)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (phone) DO UPDATE
			SET user_id = $2, otp = $3, expires_at = $4, created_at = now(), attempts = 0`,
			[phone, userId, otp, expiresAt],
		);
	}

	/**
	 * Store a new code only if the last one for this number is older than the
	 * cooldown — in ONE statement, so parallel requests cannot each send one
	 * (read-then-write let them through, one text each). Answers whether this
	 * call may send.
	 */
	async claimSend(userId: string, phone: string, otp: string, expiresAt: Date, cooldownMs: number): Promise<boolean> {
		const rows = await this.store.query(
			`INSERT INTO fonderie_phone_verifications (phone, user_id, otp, expires_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (phone) DO UPDATE
			 SET user_id = $2, otp = $3, expires_at = $4, created_at = now(), attempts = 0
			 WHERE fonderie_phone_verifications.created_at <= now() - make_interval(secs => $5)
			    OR fonderie_phone_verifications.user_id IS DISTINCT FROM $2
			 RETURNING phone`,
			[phone, userId, otp, expiresAt, cooldownMs / 1000],
		);
		return rows.length > 0;
	}

	/**
	 * Use a code, in ONE statement: the right one is consumed (a second request
	 * with it finds nothing), a wrong one spends a try, and after five the code
	 * is spent whatever is typed. Before, a check then a delete let two racing
	 * requests both sign in with one code.
	 */
	async consume(userId: string, otp: string): Promise<'ok' | 'invalid' | 'expired' | 'exhausted'> {
		const [row] = await this.store.query<{ matched: boolean; expired: boolean; attempts: number }>(
			`WITH current AS (
			   SELECT phone, otp = $2 AS matched, expires_at <= now() AS expired, attempts
			   FROM fonderie_phone_verifications WHERE user_id = $1
			   -- One row: the one this code belongs to, else the latest sent.
			   ORDER BY (otp = $2) DESC, created_at DESC
			   LIMIT 1
			   FOR UPDATE
			 ), used AS (
			   DELETE FROM fonderie_phone_verifications v USING current c
			   WHERE v.phone = c.phone AND c.matched AND NOT c.expired AND c.attempts < $3
			 ), missed AS (
			   UPDATE fonderie_phone_verifications v SET attempts = v.attempts + 1
			   FROM current c
			   WHERE v.phone = c.phone AND NOT (c.matched AND NOT c.expired AND c.attempts < $3)
			 )
			 SELECT matched, expired, attempts FROM current`,
			[userId, otp, PHONE_OTP_MAX_ATTEMPTS],
		);
		if (!row) return 'invalid';
		if (row.attempts >= PHONE_OTP_MAX_ATTEMPTS) return 'exhausted';
		if (row.expired) return 'expired';
		return row.matched ? 'ok' : 'invalid';
	}

	async findByUser(
		userId: string,
		otp: string,
	): Promise<{ phone: string; expiresAt: Date } | null> {
		const [row] = await this.store.query<{ phone: string; expires_at: Date }>(
			`SELECT phone, expires_at FROM fonderie_phone_verifications WHERE user_id = $1 AND otp = $2`,
			[userId, otp],
		);
		if (!row) return null;
		return { phone: row.phone, expiresAt: new Date(row.expires_at) };
	}

	async findLastSentAt(userId: string): Promise<Date | null> {
		const [row] = await this.store.query<{ created_at: Date }>(
			`SELECT created_at FROM fonderie_phone_verifications WHERE user_id = $1`,
			[userId],
		);
		if (!row) return null;
		return new Date(row.created_at);
	}

	async deleteByUser(userId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_phone_verifications WHERE user_id = $1`, [userId]);
	}
}
