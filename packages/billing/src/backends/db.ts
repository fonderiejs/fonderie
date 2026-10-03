import type { IStoreAdapter } from '@fonderie/store';
import type { ICounterBackend } from './types';

// Postgres-backed windowed counters, shared by every instance — the backend to
// use on serverless, where 'memory' counts per instance and resets on every
// cold start.
//
// One row per (subscriber, metric, window length, window) in
// fonderie_usage_counters. The
// window is fixed and epoch-aligned — the same period IBillingContext's
// `resetsAt` advertises — so a '1d' counter resets at 00:00 UTC. increment()
// is ONE statement: an atomic upsert (quantity = quantity + n) that returns the
// new total, so concurrent requests never lose a count and never read a stale
// one. Rows past their window are dead weight: purgeUsageCounters() removes
// them (call it from a cron), and the backend also purges opportunistically,
// at most once per PURGE_INTERVAL_MS per process.

const PURGE_INTERVAL_MS = 10 * 60_000;

function parseKey(key: string): [string, string, string] {
	const [subscriberType = '', subscriberId = '', ...rest] = key.split(':');
	return [subscriberType, subscriberId, rest.join(':')];
}

// The fixed window `now` falls in. A lifetime counter (windowMs null) lives in
// one row at the epoch that never expires.
export function counterWindow(
	windowMs: number | null,
	now: number = Date.now(),
): { start: Date; expiresAt: Date | null } {
	if (windowMs === null) return { start: new Date(0), expiresAt: null };
	const start = Math.floor(now / windowMs) * windowMs;
	return { start: new Date(start), expiresAt: new Date(start + windowMs) };
}

/**
 * Delete the 'db' backend's counters whose window has ended. Idempotent and
 * safe to run concurrently; returns how many rows went. Lifetime counters are
 * never purged.
 */
export async function purgeUsageCounters(
	store: IStoreAdapter,
	opts: { now?: Date } = {},
): Promise<number> {
	const rows = await store.query<{ n: string | number }>(
		`WITH gone AS (
			DELETE FROM fonderie_usage_counters
			 WHERE expires_at IS NOT NULL AND expires_at <= $1
			RETURNING 1
		)
		SELECT COUNT(*) AS n FROM gone`,
		[opts.now ?? new Date()],
	);
	return Number(rows[0]?.n ?? 0);
}

export class DBCounterBackend implements ICounterBackend {
	private lastPurge = 0;

	constructor(
		private readonly store: IStoreAdapter,
		private readonly opts: { opportunisticPurge?: boolean } = {},
	) {}

	async increment(key: string, windowMs: number | null, quantity = 1): Promise<number> {
		const [subscriberType, subscriberId, metric] = parseKey(key);
		const { start, expiresAt } = counterWindow(windowMs);

		const rows = await this.store.query<{ quantity: string | number }>(
			`INSERT INTO fonderie_usage_counters
				(subscriber_type, subscriber_id, metric, window_ms, window_start, quantity, expires_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (subscriber_type, subscriber_id, metric, window_ms, window_start)
			 DO UPDATE SET quantity = fonderie_usage_counters.quantity + EXCLUDED.quantity
			 RETURNING quantity`,
			[subscriberType, subscriberId, metric, windowMs ?? 0, start, quantity, expiresAt],
		);

		this.maybePurge();
		return Number(rows[0]?.quantity ?? quantity);
	}

	async get(key: string, windowMs: number | null): Promise<number> {
		const [subscriberType, subscriberId, metric] = parseKey(key);
		const { start } = counterWindow(windowMs);
		const rows = await this.store.query<{ quantity: string | number }>(
			`SELECT quantity FROM fonderie_usage_counters
			  WHERE subscriber_type = $1 AND subscriber_id = $2
			    AND metric = $3 AND window_ms = $4 AND window_start = $5`,
			[subscriberType, subscriberId, metric, windowMs ?? 0, start],
		);
		return Number(rows[0]?.quantity ?? 0);
	}

	// Fire-and-forget: a purge must never slow or fail the request that ran it.
	private maybePurge(): void {
		if (this.opts.opportunisticPurge === false) return;
		const now = Date.now();
		if (now - this.lastPurge < PURGE_INTERVAL_MS) return;
		this.lastPurge = now;
		void purgeUsageCounters(this.store).catch((err) => {
			// eslint-disable-next-line no-console
			console.error('[billing] usage counter purge failed:', (err as Error).message);
		});
	}
}
