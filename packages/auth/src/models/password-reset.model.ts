import type { IStoreAdapter } from '@fonderie-js/store';

export class PasswordResetModel {
	constructor(private store: IStoreAdapter) {}

	async create(userId: string, token: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_password_resets (user_id, token, expires_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id) DO UPDATE
			SET token = $2, expires_at = $3`,
			[userId, token, expiresAt],
		);
	}

	async find(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
		const [row] = await this.store.query<{ user_id: string; expires_at: Date }>(
			`SELECT user_id, expires_at FROM fonderie_password_resets WHERE token = $1`,
			[token],
		);
		if (!row) return null;
		return { userId: row.user_id, expiresAt: new Date(row.expires_at) };
	}

	async delete(token: string): Promise<void> {
		await this.store.query(
			`DELETE FROM fonderie_password_resets WHERE token = $1`,
			[token],
		);
	}
}
