import type { IStoreAdapter } from '@fonderie/store';

export class EmailVerificationModel {
	constructor(private store: IStoreAdapter) {}

	// `email` is the address the code is sent to: verify() marks that address
	// verified only while it is still the account's email.
	async create(userId: string, pin: string, expiresAt: Date, email: string | null = null): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_email_verifications (user_id, token, expires_at, email)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3, email = $4, created_at = now()`,
			[userId, pin, expiresAt, email],
		);
	}

	/**
	 * Use a code, in ONE statement: it is consumed, and the account's email is
	 * marked verified only if the code was sent to that very address (a code
	 * from before this column existed has none, and is trusted as before).
	 */
	async verify(userId: string, pin: string): Promise<'verified' | 'invalid' | 'expired' | 'stale'> {
		const [row] = await this.store.query<{ found: boolean; expired: boolean | null; verified: boolean }>(
			`WITH v AS (
			   DELETE FROM fonderie_email_verifications
			   WHERE user_id = $1 AND token = $2
			   RETURNING expires_at <= now() AS expired, email
			 ), u AS (
			   UPDATE fonderie_users SET email_verified_at = now(), updated_at = now()
			   WHERE id = $1 AND EXISTS (
			     SELECT 1 FROM v WHERE NOT v.expired AND (v.email IS NULL OR v.email = fonderie_users.email)
			   )
			   RETURNING id
			 )
			 SELECT EXISTS (SELECT 1 FROM v) AS found,
			        (SELECT expired FROM v) AS expired,
			        EXISTS (SELECT 1 FROM u) AS verified`,
			[userId, pin],
		);
		if (!row?.found) return 'invalid';
		if (row.expired) return 'expired';
		return row.verified ? 'verified' : 'stale';
	}

	async find(pin: string): Promise<{ userId: string; expiresAt: Date } | null> {
		const [row] = await this.store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_email_verifications WHERE token = $1`,
			[pin],
		);
		if (!row) return null;
		return { userId: row.user_id, expiresAt: new Date(row.expires_at) };
	}

	async delete(pin: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_email_verifications WHERE token = $1`, [pin]);
	}

	async findByUser(userId: string, pin: string): Promise<{ expiresAt: Date } | null> {
		const [row] = await this.store.query<{ expires_at: Date }>(
			`SELECT expires_at FROM fonderie_email_verifications WHERE user_id = $1 AND token = $2`,
			[userId, pin],
		);
		if (!row) return null;
		return { expiresAt: new Date(row.expires_at) };
	}

	async findLastSentAt(userId: string): Promise<Date | null> {
		const [row] = await this.store.query<{ created_at: Date }>(
			`SELECT created_at FROM fonderie_email_verifications WHERE user_id = $1`,
			[userId],
		);
		if (!row) return null;
		return new Date(row.created_at);
	}

	async replace(userId: string, pin: string, expiresAt: Date, email: string | null = null): Promise<void> {
		await this.store.query(
			// One code per account (user_id is the key): the new one replaces it.
			`INSERT INTO fonderie_email_verifications (token, user_id, expires_at, email)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (user_id) DO UPDATE SET token = $1, expires_at = $3, email = $4, created_at = now()`,
			[pin, userId, expiresAt, email],
		);
	}

	/**
	 * Change the account's email and issue the code for the new address, in ONE
	 * transaction: two changes racing cannot leave the account on one address
	 * with the live code sent to the other. Answers false when the address is
	 * taken (the unique index decides, not an earlier read).
	 */
	async changeEmail(userId: string, email: string, pin: string, expiresAt: Date): Promise<boolean> {
		try {
			await this.store.transaction(async (tx) => {
				await tx.query(
					`UPDATE fonderie_users SET email = $2, email_verified_at = NULL, updated_at = now() WHERE id = $1`,
					[userId, email],
				);
				await new EmailVerificationModel(tx).replace(userId, pin, expiresAt, email);
			});
			return true;
		} catch (err) {
			if ((err as { code?: string }).code === '23505') return false;
			throw err;
		}
	}
}
