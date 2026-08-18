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

// SAR export (SOC 2 Privacy) — the workspaces data owned by a user: their active
// memberships and roles. Wire the contributor below into
// @fonderie/auth's config.dataExportContributors so /users/export includes it.
export async function exportUserData(store: IStoreAdapter, userId: string): Promise<unknown> {
	const rows = await store.query<{ workspace_id: string; role_id: string; role_name: string }>(
		`SELECT ruw.workspace_id, ruw.role_id, r.name AS role_name
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.user_id = $1 AND ruw.removed = false
		 ORDER BY ruw.workspace_id`,
		[userId],
	);
	return { memberships: rows };
}

export function workspaceExportContributor(store: IStoreAdapter): {
	name: string;
	collect: (userId: string) => Promise<unknown>;
} {
	return { name: 'workspaces', collect: (userId: string) => exportUserData(store, userId) };
}
