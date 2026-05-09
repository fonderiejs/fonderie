import { setErrorResponse }    from '@fonderie-js/core';
import type { Middleware }      from '@fonderie-js/core';

import type { Operation }        from '../types';
import { PermissionsEngine }     from '../engine';
import { PERMISSIONS_ENGINE_KEY } from '../module';

export function requirePermission(
	operation:     Operation,
	permissionKey: string,
): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const engine = ctx.meta[PERMISSIONS_ENGINE_KEY]
		if (!(engine instanceof PermissionsEngine)) {
			return setErrorResponse('SERVER_ERROR', 'Permissions module not installed', 500);
		}

		const workspaceId = resolveWorkspaceId(ctx)
		if (!workspaceId) {
			return setErrorResponse('WORKSPACE_REQUIRED', 'Workspace context required', 400);
		}

		const allowed = await engine.can(ctx.user.id, operation, permissionKey, workspaceId)
		if (!allowed) {
			return setErrorResponse('FORBIDDEN', `Permission denied: ${operation}:${permissionKey}`, 403);
		}

		return next()
	}
}

function resolveWorkspaceId(
	ctx: { workspace?: { id: string } | null; meta: Record<string, unknown> }
): string | null {
	if (ctx.workspace?.id) return ctx.workspace.id

	const params = ctx.meta['params'] as Record<string, string> | undefined
	return params?.['workspaceId'] ?? null
}
