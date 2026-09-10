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

// Manager check for money-mutating billing surfaces: the workspace OWNER, or a
// member holding an ACTIVE SYSTEM role whose NAME is in `managerRoles`
// (default ['ADMIN']). is_system alone is NOT enough — GUEST is also a seeded
// system role and every default invitation lands on it; and a name match
// without is_system would reopen the C2 escalation (member-created 'ADMIN').
// Same cross-module DATA dependency and fail-closed posture as
// isWorkspaceMember above. Personal workspaces pass via owner_id.
export async function isWorkspaceManager(
	userId: string,
	workspaceId: string,
	store: IStoreAdapter,
	managerRoles: string[] = ['ADMIN'],
): Promise<boolean> {
	try {
		const rows = await store.query<{ ok: number }>(
			`SELECT 1 AS ok
			 FROM fonderie_workspaces w
			 WHERE w.id = $2
			   AND (
			     w.owner_id = $1
			     OR EXISTS (
			       SELECT 1
			       FROM fonderie_role_user_workspaces ruw
			       JOIN fonderie_roles r ON r.id = ruw.role_id
			       WHERE ruw.user_id      = $1
			         AND ruw.workspace_id = $2
			         AND ruw.removed      = false
			         AND ruw.suspended    = false
			         AND r.is_system    = true
			         AND r.active       = true
			         AND r.name         = ANY($3)
			     )
			   )
			 LIMIT 1`,
			[userId, workspaceId, managerRoles],
		);
		return rows.length > 0;
	} catch {
		return false;
	}
}
