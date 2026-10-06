import type { IStoreAdapter } from '@fonderie/store';

// Data-retention / right-to-erasure support. `deleteMe` soft-deletes a user
// (sets deleted_at) so the row stops resolving but history is preserved. A
// retention policy then hard-deletes those rows once they age past the window —
// call this from a scheduled job (e.g. daily). Related auth rows (sessions,
// resets, verifications, MFA, backup codes) are removed by ON DELETE CASCADE.

export interface IPurgeOptions {
	// Hard-delete users whose deleted_at is older than this many days.
	olderThanDays: number;
	// Given ⇒ `fonderie.user.purged` { userId } is emitted for each removed
	// account, so other bricks can erase what they hold about it (billing
	// deletes the payment provider's customer record). Accounts are then purged
	// one at a time, each delete committing only once its announcement was
	// accepted: a failing bus stops the run with every account it could not
	// announce still in place, for the next run.
	bus?: { emit(type: string, payload: unknown): Promise<void> } | undefined;
}

export async function purgeSoftDeletedUsers(
	store: IStoreAdapter,
	{ olderThanDays, bus }: IPurgeOptions,
): Promise<number> {
	if (!Number.isFinite(olderThanDays) || olderThanDays < 0) {
		throw new Error('[auth] purgeSoftDeletedUsers: olderThanDays must be a non-negative number');
	}
	if (!bus) {
		const rows = await store.query<{ id: string }>(
			`DELETE FROM fonderie_users
			 WHERE deleted_at IS NOT NULL
			   AND deleted_at < now() - make_interval(days => $1)
			 RETURNING id`,
			[olderThanDays],
		);
		return rows.length;
	}
	// With a bus: one account per transaction, announced BEFORE the commit (the
	// bus is not this store, so the two cannot commit together). A bulk delete
	// followed by an emit loop lost every remaining announcement when one emit
	// threw — those accounts were gone, and billing never deleted their payment
	// provider customers. Now a failed emit rolls its own delete back; the worst
	// case is the reverse (announced, then the commit fails), which the next run
	// repeats — at-least-once, and every listener is idempotent. Row-locked with
	// SKIP LOCKED, the same shape as the deletion schedule, so two schedulers
	// share the work.
	let purged = 0;
	for (;;) {
		const id = await store.transaction(async (tx) => {
			const [row] = await tx.query<{ id: string }>(
				`DELETE FROM fonderie_users
				 WHERE id = (
				   SELECT id FROM fonderie_users
				   WHERE deleted_at IS NOT NULL
				     AND deleted_at < now() - make_interval(days => $1)
				   ORDER BY deleted_at
				   LIMIT 1
				   FOR UPDATE SKIP LOCKED
				 )
				 RETURNING id`,
				[olderThanDays],
			);
			if (!row) return null;
			await bus.emit('fonderie.user.purged', { userId: row.id });
			return row.id;
		});
		if (id === null) return purged;
		purged++;
	}
}

// Scheduled hard-deletion of aged soft-deleted users (SOC 2 C1/P4, right to
// erasure follow-through). Runs once immediately, then every intervalMs.
// Non-blocking (timer unref'd). .stop() cancels.
export interface IUserRetentionScheduleOptions extends IPurgeOptions {
	intervalMs?: number; // default 24h
	onPurge?: (deleted: number) => void;
}

export function startUserRetention(
	store: IStoreAdapter,
	options: IUserRetentionScheduleOptions,
): { stop: () => void } {
	const intervalMs = options.intervalMs ?? 24 * 60 * 60 * 1000;
	let stopped = false;
	const run = async () => {
		if (stopped) return;
		try {
			const deleted = await purgeSoftDeletedUsers(store, {
				olderThanDays: options.olderThanDays,
				...(options.bus ? { bus: options.bus } : {}),
			});
			options.onPurge?.(deleted);
		} catch (err) {
			console.error('[auth] scheduled user retention purge failed:', err);
		}
	};
	const timer = setInterval(run, intervalMs);
	if (typeof (timer as { unref?: () => void }).unref === 'function') (timer as { unref: () => void }).unref();
	void run();
	return { stop: () => { stopped = true; clearInterval(timer); } };
}
