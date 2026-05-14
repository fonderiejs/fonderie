import type { IStoreAdapter } from '@fonderie-js/store';

export class SessionModel {
	constructor(private store: IStoreAdapter) {}

	async create(userId: string, token: string, expiresAt: Date): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_sessions (user_id, token, expires_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (token) DO NOTHING`,
			[userId, token, expiresAt],
		);
	}

	async delete(token: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_sessions WHERE token = $1`, [token]);
	}

	async exists(token: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`SELECT id FROM fonderie_sessions WHERE token = $1 AND expires_at > now()`,
			[token],
		);
		return rows.length > 0;
	}
}
