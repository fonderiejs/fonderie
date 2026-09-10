import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IWorkspacesConfig } from '../config';

// RBAC gate for PRIVILEGED workspace routes (role CRUD, member/invitation
// management, settings, archive). withWorkspace verifies *membership*; this
// verifies MANAGEMENT: the workspace OWNER, or a member holding an ACTIVE
// SYSTEM role (the seeded ADMIN — matching the hardened super-role rule in
// @fonderie/permissions: is_system AND active).
//
// - Runs AFTER withWorkspace: no ctx.workspace → pass through, the
//   controllers' own 404 answers.
// - Personal workspaces pass via owner_id (sole member).
// - config.management: 'any-member' restores the legacy behaviour for apps
//   that deliberately run flat teams.
export function requireManager(store: IStoreAdapter, config: IWorkspacesConfig): Middleware {
	return async (ctx, next) => {
		if (config.management === 'any-member') return next();

		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}
		if (!ctx.workspace) return next();

		const ownerId = (ctx.workspace as { ownerId?: string }).ownerId;
		if (ownerId && ownerId === ctx.user.id) return next();

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
			 LIMIT 1`,
			[ctx.user.id, ctx.workspace.id],
		);
		if (!row) {
			return setApiResponse(
				HTTP.FORBIDDEN,
				'MANAGER_REQUIRED',
				'This action requires the workspace owner or an admin role',
			);
		}

		return next();
	};
}
