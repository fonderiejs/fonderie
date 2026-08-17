import type { IStoreAdapter } from '@fonderie/store';

// Retention for the append-only event/audit log. Events accumulate forever by
// default; a retention policy disposes of them once they age past the window.
// Call from a scheduled job. Per-consumer delivery rows are removed by
// ON DELETE CASCADE. Note: purging is disposal, not tampering — it removes whole
// aged rows wholesale and does not touch the HMAC of anything it keeps.

export interface IPurgeEventsOptions {
	// Delete events whose created_at is older than this many days.
	olderThanDays: number;
}

export async function purgeEvents(
	store: IStoreAdapter,
	{ olderThanDays }: IPurgeEventsOptions,
): Promise<number> {
	if (!Number.isFinite(olderThanDays) || olderThanDays < 0) {
		throw new Error('[events] purgeEvents: olderThanDays must be a non-negative number');
	}
	const rows = await store.query<{ id: string }>(
		`DELETE FROM fonderie_events
		 WHERE created_at < now() - make_interval(days => $1)
		 RETURNING id`,
		[olderThanDays],
	);
	return rows.length;
}

// Scheduled disposal (SOC 2 C1/P4). Runs purgeEvents on an interval so aged
// audit/event rows don't accumulate past the policy window. Runs once
// immediately, then every intervalMs. Non-blocking (timer unref'd). .stop() cancels.
export interface IRetentionScheduleOptions extends IPurgeEventsOptions {
	intervalMs?: number; // default 24h
	onPurge?: (deleted: number) => void;
}

export function startEventRetention(
	store: IStoreAdapter,
	options: IRetentionScheduleOptions,
): { stop: () => void } {
	const intervalMs = options.intervalMs ?? 24 * 60 * 60 * 1000;
	let stopped = false;
	const run = async () => {
		if (stopped) return;
		try {
			const deleted = await purgeEvents(store, { olderThanDays: options.olderThanDays });
			options.onPurge?.(deleted);
		} catch (err) {
			console.error('[events] scheduled retention purge failed:', err);
		}
	};
	const timer = setInterval(run, intervalMs);
	if (typeof (timer as { unref?: () => void }).unref === 'function') (timer as { unref: () => void }).unref();
	void run();
	return { stop: () => { stopped = true; clearInterval(timer); } };
}
