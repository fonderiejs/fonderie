import type { IStoreAdapter } from '@fonderie/store';

// What @fonderie/workspaces says about a member deleting their account
// (docs/ACCOUNT-DELETION-DESIGN.md, D4). Wire it into auth:
//
//   new AuthModule(store, { accountDeletion: { blockers: [accountDeletionBlocker(store)] } })
//
// An owner of a TEAM — a workspace other people still belong to — must hand it
// over first (transfer ownership) or remove it: deleting the account would
// leave the team with no owner, and nobody could ever manage it again. A
// personal workspace, or one with no other members, goes with the account.

export interface IAccountDeletionRefusal {
	reason: string;
	explanation: string;
	details?: Record<string, unknown>;
}

export function accountDeletionBlocker(store: IStoreAdapter) {
	return async (userId: string): Promise<IAccountDeletionRefusal | null> => {
		const teams = await store.query<{ id: string; name: string; members: number }>(
			`SELECT w.id, w.name, COUNT(DISTINCT ruw.user_id)::int AS members
			 FROM fonderie_workspaces w
			 JOIN fonderie_role_user_workspaces ruw
			   ON ruw.workspace_id = w.id AND ruw.user_id <> w.owner_id
			  AND ruw.removed = false AND ruw.suspended = false
			 JOIN fonderie_users u ON u.id = ruw.user_id AND u.deleted_at IS NULL
			 WHERE w.owner_id = $1 AND w.archived_at IS NULL AND NOT COALESCE(w.is_personal, false)
			 GROUP BY w.id, w.name
			 ORDER BY w.name`,
			[userId],
		);
		if (teams.length === 0) return null;
		return {
			reason: 'OWNS_TEAM_WORKSPACE',
			explanation: `You own ${teams.length === 1 ? 'a team' : `${teams.length} teams`} with other members (${teams.map((t) => t.name).join(', ')}). Transfer ownership to someone else first.`,
			details: { workspaces: teams.map((t) => t.name).join(', '), workspaceIds: teams.map((t) => t.id).join(',') },
		};
	};
}
