import type { IStoreAdapter } from '@fonderie/store';

import type { IRequestMeta } from '../services/request-meta';

export class SessionModel {
	constructor(private store: IStoreAdapter) {}

	async create(
		userId: string,
		token: string,
		expiresAt: Date,
		sid?: string,
		meta?: IRequestMeta,
	): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_sessions (user_id, token, expires_at, sid, user_agent, ip_address)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (token) DO NOTHING`,
			[userId, token, expiresAt, sid ?? null, meta?.userAgent ?? null, meta?.ipAddress ?? null],
		);
	}

	async delete(token: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_sessions WHERE token = $1`, [token]);
	}

	// Revoke every session for a user (e.g. on password change). Access tokens
	// bound to these sessions via the sid claim die on their next request.
	async deleteByUser(userId: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_sessions WHERE user_id = $1`, [userId]);
	}

	// Session metadata for a user (no tokens) — for the data-export / SAR bundle.
	async listByUser(userId: string): Promise<
		Array<{ id: string; userAgent: string | null; ipAddress: string | null; createdAt: Date; expiresAt: Date }>
	> {
		return this.store.query(
			`SELECT id,
			        user_agent AS "userAgent",
			        ip_address AS "ipAddress",
			        created_at AS "createdAt",
			        expires_at AS "expiresAt"
			 FROM fonderie_sessions
			 WHERE user_id = $1
			 ORDER BY created_at DESC`,
			[userId],
		);
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
