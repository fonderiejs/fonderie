import type { IStoreAdapter } from '@fonderie/store';

// Access-grant export (SOC 2 CC6.2/6.3) — feeds the access-review register with
// the current who-has-what: every active user→workspace→role grant. Run this on
// a schedule (or during a review) and diff against the previous snapshot.

export interface IGrant {
	userId: string;
	workspaceId: string;
	roleId: string;
	roleName: string;
	suspended: boolean;
}

export async function listGrants(store: IStoreAdapter): Promise<IGrant[]> {
	const rows = await store.query<{
		user_id: string;
		workspace_id: string;
		role_id: string;
		role_name: string;
		suspended: boolean;
	}>(
		`SELECT ruw.user_id, ruw.workspace_id, ruw.role_id, r.name AS role_name, ruw.suspended
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.removed = false
		 ORDER BY ruw.workspace_id, ruw.user_id`,
	);
	return rows.map((r) => ({
		userId: r.user_id,
		workspaceId: r.workspace_id,
		roleId: r.role_id,
		roleName: r.role_name,
		suspended: r.suspended,
	}));
}
