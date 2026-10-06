import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IWorkspacesConfig } from '../config';
import { accessFor } from './access-snapshot';

// RBAC gate for PRIVILEGED workspace routes (role CRUD, member/invitation
// management, settings, archive). withWorkspace verifies *membership*; this
// verifies MANAGEMENT: the workspace OWNER, or a member holding an ACTIVE
// SYSTEM role whose NAME is in the manager list (default ['ADMIN']).
//
// The name match matters on BOTH axes: is_system alone is NOT enough — GUEST
// is also a seeded system role, and every default invitation lands on it, so
// "any system role" would make every member a manager. And a name match
// without is_system would reopen the C2 escalation (a member-created
// workspace-local role named 'ADMIN' must grant nothing).
//
// - Runs AFTER withWorkspace: no ctx.workspace → pass through, the
//   controllers' own 404 answers.
// - Personal workspaces pass via owner_id (sole member).
// - config.management: 'any-member' restores the legacy behaviour for apps
//   that deliberately run flat teams; config.managerRoles overrides the
//   accepted system-role names.
/**
 * Is this user a manager of this workspace — its owner, or a holder of an
 * active SYSTEM role named in managerRoles? The one definition shared by the
 * route gate below and the effective-permissions read, so what a client is
 * told and what the server enforces cannot drift.
 */
export async function isWorkspaceManager(
	store: IStoreAdapter,
	config: IWorkspacesConfig,
	userId: string,
	workspace: { id: string; ownerId?: string },
): Promise<boolean> {
	if (config.management === 'any-member') return true;
	if (workspace.ownerId && workspace.ownerId === userId) return true;
	const [row] = await store.query<{ ok: number }>(
		`SELECT 1 AS ok
		 FROM fonderie_role_user_workspaces ruw
		 JOIN fonderie_roles r ON r.id = ruw.role_id
		 WHERE ruw.user_id      = $1
		   AND ruw.workspace_id = $2
		   AND ruw.removed      = false
		   AND ruw.suspended    = false
		   AND r.is_system    = true
		   AND r.active       = true
		   AND r.name         = ANY($3)
		 LIMIT 1`,
		[userId, workspace.id, config.managerRoles ?? ['ADMIN']],
	);
	return !!row;
}

export function requireManager(store: IStoreAdapter, config: IWorkspacesConfig): Middleware {
	return async (ctx, next) => {
		if (config.management === 'any-member') return next();

		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}
		if (!ctx.workspace) return next();

		const workspace = ctx.workspace as { id: string; ownerId?: string };
		// withWorkspace already read this member's system roles for this very
		// request — the same predicate isWorkspaceManager queries. Use them
		// instead of a second round-trip; anything else (another workspace,
		// a context set some other way) asks the database.
		const seen = accessFor(ctx, ctx.user.id, workspace.id);
		const manager = seen
			? (!!workspace.ownerId && workspace.ownerId === ctx.user.id) ||
				seen.systemRoles.some((r) => (config.managerRoles ?? ['ADMIN']).includes(r))
			: await isWorkspaceManager(store, config, ctx.user.id, workspace);
		if (!manager) {
			return setApiResponse(
				HTTP.FORBIDDEN,
				'MANAGER_REQUIRED',
				'This action requires the workspace owner or an admin role',
			);
		}

		return next();
	};
}
