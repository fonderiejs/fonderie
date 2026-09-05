import type { IStoreAdapter } from '@fonderie/store';

// Workspace-membership verification for header-derived subscribers.
//
// This is a deliberate cross-module DATA dependency (billing reads the
// workspaces module's membership table) rather than a code import — modules
// never import each other. The predicate mirrors @fonderie/workspaces'
// getMember exactly: an active member is a role_user_workspaces row that is
// neither removed nor suspended.
//
// Fail closed: when the query errors (e.g. the workspaces module — and thus
// its table — is not installed), the caller is NOT a member. Apps without
// workspaces never send X-Workspace-ID legitimately, so nothing breaks; an
// attacker probing with the header gets a 403 instead of a wallet.
export async function isWorkspaceMember(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
): Promise<boolean> {
	try {
		const rows = await store.query<{ ok: number }>(
			`SELECT 1 AS ok
			 FROM fonderie_role_user_workspaces
			 WHERE user_id      = $1
			   AND workspace_id = $2
			   AND removed      = false
			   AND suspended    = false
			 LIMIT 1`,
			[userId, workspaceId],
		);
		return rows.length > 0;
	} catch {
		return false;
	}
}
