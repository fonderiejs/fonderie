import type { IStoreAdapter } from '@fonderie/store';

export class SessionModel {
	constructor(private store: IStoreAdapter) {}

	async create(userId: string, token: string, expiresAt: Date, sid?: string): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_sessions (user_id, token, expires_at, sid)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (token) DO NOTHING`,
			[userId, token, expiresAt, sid ?? null],
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

	// Liveness check for session-bound access tokens (by the sid claim).
	async aliveBySid(sid: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`SELECT id FROM fonderie_sessions WHERE sid = $1 AND expires_at > now()`,
			[sid],
		);
		return rows.length > 0;
	}
}
