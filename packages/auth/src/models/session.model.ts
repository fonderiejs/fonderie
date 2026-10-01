import { createHash } from 'node:crypto';

import type { IStoreAdapter } from '@fonderie/store';

import type { IRequestMeta } from '../services/request-meta';
import { CLIENT_KINDS, type ClientKind } from '../services/session-policy';
import { type IRequestLocation, type LocationResolver, resolveLocation } from '../services/request-location';

// What `fonderie_sessions.token` holds: the SHA-256 of the refresh token, so a
// database dump contains no working refresh token. Lookups also accept the raw
// value, for rows written before migration 020 hashed them.
export function hashRefreshToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/** How long a just-rotated refresh token stays valid: a retry or a race. */
export const REFRESH_GRACE_MS = 30_000;

export interface ISessionRow {
	id: string;
	userId: string;
	sid: string | null;
	/** What the stored `token` column holds now (a hash, or a legacy raw token). */
	stored: string;
	/** When the device signed in — the start of the absolute cap. */
	createdAt: Date;
	/** The platform declared at sign-in — its lifetimes apply at every refresh. */
	clientKind: ClientKind | null;
}

/** How a presented refresh token relates to the sessions table. */
export type RefreshMatch =
	| { kind: 'current'; row: ISessionRow }
	| { kind: 'grace'; row: ISessionRow }
	| { kind: 'reused'; row: ISessionRow }
	| { kind: 'unknown' };

export class SessionModel {
	// `locate` is IAuthConfig.location. Absent ⇒ sessions carry no location.
	constructor(
		private store: IStoreAdapter,
		private locate?: LocationResolver,
	) {}

	async create(
		userId: string,
		token: string,
		expiresAt: Date,
		sid?: string,
		meta?: IRequestMeta,
	): Promise<void> {
		const location =
			this.locate && meta?.headers
				? await resolveLocation(this.locate, { ip: meta.ipAddress, headers: meta.headers })
				: null;
		await this.store.query(
			`INSERT INTO fonderie_sessions (user_id, token, expires_at, sid, user_agent, ip_address, location, last_used_at, client_kind)
			VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
			ON CONFLICT (token) DO NOTHING`,
			[
				userId,
				hashRefreshToken(token),
				expiresAt,
				sid ?? null,
				meta?.userAgent ?? null,
				meta?.ipAddress ?? null,
				location ? JSON.stringify(location) : null,
				meta?.clientKind ?? null,
			],
		);
	}

	async delete(token: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_sessions WHERE token IN ($1, $2)`, [hashRefreshToken(token), token]);
	}

	/**
	 * Where a presented refresh token stands: the session's current token, its
	 * previous one within the grace (a retry or race), its previous one AFTER
	 * the grace (reuse — a theft signal), or nothing known.
	 */
	async match(token: string): Promise<RefreshMatch> {
		const hash = hashRefreshToken(token);
		const [current] = await this.store.query<{ id: string; user_id: string; sid: string | null; token: string; created_at: Date; client_kind: string | null }>(
			`SELECT id, user_id, sid, token, created_at, client_kind FROM fonderie_sessions WHERE token IN ($1, $2) AND expires_at > now() LIMIT 1`,
			[hash, token],
		);
		if (current) return { kind: 'current', row: toRow(current) };
		const [previous] = await this.store.query<{ id: string; user_id: string; sid: string | null; token: string; created_at: Date; client_kind: string | null; in_grace: boolean }>(
			`SELECT id, user_id, sid, token, created_at, client_kind, (previous_valid_until > now()) AS in_grace
			   FROM fonderie_sessions WHERE previous_token_hash = $1 AND expires_at > now() LIMIT 1`,
			[hash],
		);
		if (!previous) return { kind: 'unknown' };
		return { kind: previous.in_grace ? 'grace' : 'reused', row: toRow(previous) };
	}

	/**
	 * Rotate a session in place to a new refresh token: same row, same device.
	 * From the CURRENT token it is optimistic — only if the stored token is
	 * still the one matched; a concurrent rotation makes it return false and the
	 * caller re-matches (and now finds the token as the previous one). The old
	 * token becomes the previous, valid for the grace. From the PREVIOUS token
	 * (within the grace) it is authorised by that hash and deadline alone, so
	 * racing retries never starve; the previous and its deadline are kept.
	 */
	async rotate(
		row: ISessionRow,
		presented: string,
		next: { token: string; expiresAt: Date },
		from: 'current' | 'grace',
	): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`UPDATE fonderie_sessions
			    SET previous_token_hash  = CASE WHEN $5 THEN $6 ELSE previous_token_hash END,
			        previous_valid_until = CASE WHEN $5 THEN now() + ($7 || ' milliseconds')::interval ELSE previous_valid_until END,
			        token        = $3,
			        expires_at   = $4,
			        last_used_at = now()
			  WHERE id = $1
			    AND CASE WHEN $5 THEN token = $2
			             ELSE previous_token_hash = $6 AND previous_valid_until > now() END
			RETURNING id`,
			[row.id, row.stored, hashRefreshToken(next.token), next.expiresAt, from === 'current', hashRefreshToken(presented), String(REFRESH_GRACE_MS)],
		);
		return rows.length === 1;
	}

	/** Revoke one session by its row id (any user) — reuse detection, admin. */
	async revokeById(id: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_sessions WHERE id = $1`, [id]);
	}

	// Delete the session an access token is bound to (by its sid claim). Lets
	// logout revoke the current session without the client resending the refresh
	// token — the access token already identifies its session.
	async deleteBySid(sid: string): Promise<void> {
		await this.store.query(`DELETE FROM fonderie_sessions WHERE sid = $1`, [sid]);
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

	// Live sessions for the Active Sessions screen: unexpired only, carrying the
	// sid so the caller can flag the current one (row.sid === the JWT's sid).
	// No token — that never leaves the server.
	async listLiveByUser(userId: string): Promise<
		Array<{
			id: string;
			sid: string | null;
			userAgent: string | null;
			ipAddress: string | null;
			location: IRequestLocation | null;
			clientKind: string | null;
			createdAt: Date;
			expiresAt: Date;
		}>
	> {
		return this.store.query(
			`SELECT id, sid, client_kind AS "clientKind",
			        user_agent AS "userAgent",
			        ip_address AS "ipAddress",
			        location,
			        created_at AS "createdAt",
			        expires_at AS "expiresAt"
			 FROM fonderie_sessions
			 WHERE user_id = $1 AND expires_at > now()
			 ORDER BY created_at DESC`,
			[userId],
		);
	}

	// Terminate one session by row id, scoped to its owner (a user can never
	// delete another user's session). Returns whether a row was removed.
	async terminateById(userId: string, id: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`DELETE FROM fonderie_sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
			[id, userId],
		);
		return rows.length > 0;
	}

	// Terminate all of a user's sessions except the current one (by sid).
	// Returns the number of sessions removed.
	async terminateOthers(userId: string, keepSid: string): Promise<number> {
		const rows = await this.store.query<{ id: string }>(
			`DELETE FROM fonderie_sessions
			 WHERE user_id = $1 AND (sid IS DISTINCT FROM $2)
			 RETURNING id`,
			[userId, keepSid],
		);
		return rows.length;
	}

	async exists(token: string): Promise<boolean> {
		const rows = await this.store.query<{ id: string }>(
			`SELECT id FROM fonderie_sessions WHERE token IN ($1, $2) AND expires_at > now()`,
			[hashRefreshToken(token), token],
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

function toRow(r: { id: string; user_id: string; sid: string | null; token: string; created_at?: Date; client_kind?: string | null }): ISessionRow {
	const kind = (CLIENT_KINDS as readonly string[]).includes(r.client_kind ?? '') ? (r.client_kind as ClientKind) : null;
	return { id: r.id, userId: r.user_id, sid: r.sid, stored: r.token, createdAt: r.created_at ? new Date(r.created_at) : new Date(), clientKind: kind };
}
