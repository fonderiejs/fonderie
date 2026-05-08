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
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const engine = ctx.meta[PERMISSIONS_ENGINE_KEY]
		if (!(engine instanceof PermissionsEngine)) {
			return Response.json({ error: 'Permissions module not installed' }, { status: 500 });
		}

		const workspaceId = resolveWorkspaceId(ctx)
		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		const allowed = await engine.can(ctx.user.id, operation, permissionKey, workspaceId)
		if (!allowed) {
			return Response.json(
				{ error: `Permission denied: ${operation}:${permissionKey}` },
				{ status: 403 },
			)
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
