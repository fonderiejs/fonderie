import type { IStoreAdapter } from '@fonderie/store';

// Cross-module erasure (SOC 2 Privacy / right to erasure). `fonderie_role_user_workspaces`
// keys on `user_id` but carries no FK to `fonderie_users` — workspaces is usable
// without @fonderie/auth, so it can't hard-depend on the users table. That means
// a user hard-deleted in auth would otherwise leave orphan membership/role rows
// here. Call this from the app's erasure flow to remove them.

export async function deleteUserData(store: IStoreAdapter, userId: string): Promise<number> {
	const rows = await store.query<{ user_id: string }>(
		`DELETE FROM fonderie_role_user_workspaces WHERE user_id = $1 RETURNING user_id`,
		[userId],
	);
	return rows.length;
}
