import type { IStoreAdapter } from '@fonderie-js/store';

export class PasswordResetModel {
	constructor(private store: IStoreAdapter) {}

	async create(userId: string, pin: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_password_resets (user_id, pin, expires_at, created_at)
			VALUES ($1, $2, $3, now())
			ON CONFLICT (user_id) DO UPDATE
			SET pin = $2, expires_at = $3, created_at = now()`,
			[userId, pin, expiresAt],
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
			[pin],
		);
		if (!row) return null;
		return { userId: row.user_id, expiresAt: new Date(row.expires_at) };
	}

	async deleteByUser(userId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_password_resets WHERE user_id = $1`, [userId]);
	}
}
