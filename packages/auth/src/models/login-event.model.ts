import type { IStoreAdapter } from '@fonderie/store';

// One row per login ATTEMPT — success or failure — across every method.
// Append-only: rows survive logout/expiry (unlike fonderie_sessions, which is
// the live-session list and the single source of truth for Active Sessions).
// user_id is nullable so unknown-email attempts still record.
export type LoginMethod = 'password' | 'phone' | 'mfa' | 'oauth-google';
export type LoginOutcome = 'success' | 'failed';

export interface ILoginEventInput {
	userId: string | null;
	emailAttempted?: string | null;
	method: LoginMethod;
	outcome: LoginOutcome;
	failureReason?: string | null;
	ipAddress: string | null;
	userAgent: string | null;
}

export class LoginEventModel {
	constructor(private store: IStoreAdapter) {}

	async record(e: ILoginEventInput): Promise<void> {
		await this.store.query(
			`INSERT INTO fonderie_login_events
			   (user_id, email_attempted, method, outcome, failure_reason, ip_address, user_agent)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			[
				e.userId,
				e.emailAttempted ?? null,
				e.method,
				e.outcome,
				e.failureReason ?? null,
				e.ipAddress,
				e.userAgent,
			],
		);
	}

	// Fire-and-forget variant for the login paths: recording history must never
	// block or fail a login (same posture as the bus.emit(...).catch(() => {})
	// notification sends).
	recordSafe(e: ILoginEventInput): void {
		void this.record(e).catch(() => {});
	}

	// One page of a user's own login history, newest first. Keyset-paginated on
	// (created_at, id) — mirrors audit's event list so the two log UIs share a
	// cursor contract. The +1 over-fetch that detects a next page lives here so
	// no outer clamp can shave it off.
	async listByUser(query: ILoginEventQuery): Promise<ILoginEventPage> {
		const limit = Math.min(query.limit ?? 50, MAX_HISTORY_LIMIT);
		const params: unknown[] = [query.userId];
		const where: string[] = ['user_id = $1'];

		if (query.outcome) {
			params.push(query.outcome);
			where.push(`outcome = $${params.length}`);
		}
		if (query.from) {
			params.push(query.from);
			where.push(`created_at >= $${params.length}`);
		}
		if (query.to) {
			params.push(query.to);
			where.push(`created_at <= $${params.length}`);
		}
		if (query.cursor) {
			params.push(query.cursor.createdAt, query.cursor.id);
			where.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
		}

		params.push(limit + 1);
		const rows = await this.store.query<ILoginEventRow>(
			`SELECT id, method, outcome, failure_reason AS "failureReason",
			        ip_address AS "ipAddress", user_agent AS "userAgent",
			        created_at AS "createdAt", created_at::text AS "createdAtRaw"
			 FROM   fonderie_login_events
			 WHERE  ${where.join(' AND ')}
			 ORDER  BY created_at DESC, id DESC
			 LIMIT  $${params.length}`,
			params,
		);
		return { events: rows.slice(0, limit), hasMore: rows.length > limit };
	}
}

const MAX_HISTORY_LIMIT = 200;

export interface ILoginEventQuery {
	userId: string;
	outcome?: LoginOutcome;
	from?: Date;
	to?: Date;
	cursor?: { createdAt: string; id: string } | null;
	limit?: number;
}

export interface ILoginEventRow {
	id: string;
	method: LoginMethod;
	outcome: LoginOutcome;
	failureReason: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: Date;
	// created_at::text — full microsecond precision for the keyset cursor
	// (node-pg parses timestamptz into a millisecond Date, which would make the
	// cursor skip same-millisecond rows between pages).
	createdAtRaw: string;
}

export interface ILoginEventPage {
	events: ILoginEventRow[];
	hasMore: boolean;
}
