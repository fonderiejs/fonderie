import type { IStoreAdapter } from '@fonderie/store';

import { emailKey } from './services/email-key';

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

// ── Erasure at purge (docs/ACCOUNT-DELETION-DESIGN.md, Phase 4) ─────────────
//
// Auth's purge calls this in-process, once the grace period is over and just
// before it deletes the user row (this brick does not import auth). It removes what this brick holds about the person:
//
//   - every membership row of theirs (any workspace, any state);
//   - every invitation addressed to them, any status, a '+tag' alias included
//     (the "same person" rule accounts use — services/email-key.ts);
//   - their personal workspace, and every workspace they own that nobody else
//     still belongs to, with everything this brick keeps about it: roles, role
//     permissions, memberships, invitations. An app table declared
//     `REFERENCES fonderie_workspaces ON DELETE CASCADE` goes with it — a solo
//     business's data leaves with its only person;
//   - their id as `archived_by` on workspaces (and locations) that stay.
//
// A team they own that still has other members is NOT deleted. D4 refuses the
// request in that case, but people can join during the grace period: the
// workspace is left in place and reported in `kept` — never a team deleted
// under its members, never orphaned silently.
//
// One transaction; a retry after a failure finds less to do and nothing to
// trip on, so running it twice is harmless. It throws only on a real failure —
// the purge then keeps the account archived and tries again later.

export interface IErasureSubject {
	userId: string;
	email: string | null;
	phone: string | null;
}

export interface IErasureResult {
	erased: number;
	kept?: string;
}

// The same "still on the team" rule as the members list, the seat count and
// the blocker above: not removed, not suspended, an account that exists and is
// not itself waiting to be deleted.
const OTHER_LIVE_MEMBER = `EXISTS (
	SELECT 1 FROM fonderie_role_user_workspaces ruw
	JOIN fonderie_users u ON u.id = ruw.user_id AND u.deleted_at IS NULL
	WHERE ruw.workspace_id = w.id AND ruw.user_id <> $1
	  AND ruw.removed = false AND ruw.suspended = false
)`;

export function accountEraser(store: IStoreAdapter): {
	name: 'workspaces';
	erase(subject: IErasureSubject): Promise<IErasureResult>;
} {
	return { name: 'workspaces', erase: (subject) => eraseAccount(store, subject) };
}

async function eraseAccount(store: IStoreAdapter, subject: IErasureSubject): Promise<IErasureResult> {
	const { userId } = subject;
	const email = emailKey(subject.email);

	return store.transaction(async (tx) => {
		let erased = 0;
		const run = async (sql: string, params: unknown[]) => {
			erased += (await tx.query(`${sql} RETURNING 1`, params)).length;
		};

		// Lock what they own first, so nobody joins one between the check and the delete.
		const owned = await tx.query<{ id: string; teamed: boolean }>(
			`SELECT w.id, (NOT w.is_personal AND ${OTHER_LIVE_MEMBER}) AS teamed
			 FROM fonderie_workspaces w
			 WHERE w.owner_id = $1
			 ORDER BY w.id
			 FOR UPDATE OF w`,
			[userId],
		);
		const gone = owned.filter((w) => !w.teamed).map((w) => w.id);
		const kept = owned.filter((w) => w.teamed).map((w) => w.id);

		if (gone.length > 0) {
			// No foreign keys tie these tables to fonderie_workspaces — each goes explicitly.
			// Role permissions are @fonderie/permissions' table; an app without that
			// brick never created it.
			const [perms] = await tx.query<{ t: string | null }>(`SELECT to_regclass('fonderie_role_permissions')::text AS t`);
			if (perms?.t) {
				await run(
					`DELETE FROM fonderie_role_permissions
					 WHERE workspace_id = ANY($1::uuid[])
					    OR role_id IN (SELECT id FROM fonderie_roles WHERE workspace_id = ANY($1::uuid[]))`,
					[gone],
				);
			}
			await run(`DELETE FROM fonderie_role_user_workspaces WHERE workspace_id = ANY($1::uuid[])`, [gone]);
			await run(`DELETE FROM fonderie_workspace_invitations WHERE workspace_id = ANY($1::uuid[])`, [gone]);
			await run(`DELETE FROM fonderie_roles WHERE workspace_id = ANY($1::uuid[])`, [gone]);
			await run(`DELETE FROM fonderie_workspaces WHERE id = ANY($1::uuid[])`, [gone]);
		}

		await run(`DELETE FROM fonderie_role_user_workspaces WHERE user_id = $1`, [userId]);

		if (email) {
			// emailKey in SQL: trim, lowercase, drop a '+tag' from the local part.
			await run(
				`DELETE FROM fonderie_workspace_invitations
				 WHERE regexp_replace(lower(btrim(email)), '\\+[^@]*@', '@') = $1`,
				[email],
			);
		}

		await run(`UPDATE fonderie_workspaces SET archived_by = NULL, updated_at = now() WHERE archived_by = $1`, [userId]);
		const [locations] = await tx.query<{ t: string | null }>(`SELECT to_regclass('fonderie_workspace_locations')::text AS t`);
		if (locations?.t) {
			await run(`UPDATE fonderie_workspace_locations SET archived_by = NULL WHERE archived_by = $1`, [userId]);
		}

		if (kept.length === 0) return { erased };
		return {
			erased,
			kept: `${kept.length === 1 ? 'a workspace' : `${kept.length} workspaces`} they own still ${kept.length === 1 ? 'has' : 'have'} other members (${kept.join(', ')}): left in place for the team; ownership needs transferring`,
		};
	});
}
