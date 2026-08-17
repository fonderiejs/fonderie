import type { IStoreAdapter } from '@fonderie/store';

// Data-retention / right-to-erasure support. `deleteMe` soft-deletes a user
// (sets deleted_at) so the row stops resolving but history is preserved. A
// retention policy then hard-deletes those rows once they age past the window —
// call this from a scheduled job (e.g. daily). Related auth rows (sessions,
// resets, verifications, MFA, backup codes) are removed by ON DELETE CASCADE.

export interface IPurgeOptions {
	// Hard-delete users whose deleted_at is older than this many days.
	olderThanDays: number;
}

export async function purgeSoftDeletedUsers(
	store: IStoreAdapter,
	{ olderThanDays }: IPurgeOptions,
): Promise<number> {
	if (!Number.isFinite(olderThanDays) || olderThanDays < 0) {
		throw new Error('[auth] purgeSoftDeletedUsers: olderThanDays must be a non-negative number');
	}
	const rows = await store.query<{ id: string }>(
		`DELETE FROM fonderie_users
		 WHERE deleted_at IS NOT NULL
		   AND deleted_at < now() - make_interval(days => $1)
		 RETURNING id`,
		[olderThanDays],
	);
	return rows.length;
}
