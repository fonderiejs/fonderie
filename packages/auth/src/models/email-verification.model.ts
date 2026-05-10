import type { IStoreAdapter } from '@fonderie-js/store';

export class EmailVerificationModel {
	constructor(private store: IStoreAdapter) {}

	async create(userId: string, pin: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_email_verifications (user_id, token, expires_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3`,
			[userId, pin, expiresAt],
		);
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
		await this.store.query(
			`DELETE FROM fonderie_email_verifications WHERE token = $1`,
			[pin],
		);
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

	async replace(userId: string, pin: string, expiresAt: Date): Promise<void> {
		await this.store.transaction(async tx => {
			await tx.query(
				`DELETE FROM fonderie_email_verifications WHERE user_id = $1`,
				[userId],
			);
			await tx.query(
				`INSERT INTO fonderie_email_verifications (token, user_id, expires_at)
				VALUES ($1, $2, $3)`,
				[pin, userId, expiresAt],
			);
		});
	}
}
