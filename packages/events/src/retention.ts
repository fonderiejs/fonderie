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
