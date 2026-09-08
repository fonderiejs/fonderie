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
}
