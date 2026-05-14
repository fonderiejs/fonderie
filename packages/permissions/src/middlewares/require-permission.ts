import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { Middleware } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';

import type { Operation } from '../types';
import { PermissionsEngine } from '../engine';
import { PERMISSIONS_ENGINE_KEY } from '../module';

function makeHandler(operation: Operation, permissionKey: string): Middleware {
	return async (ctx, next) => {
		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}

		const engine = ctx.meta[PERMISSIONS_ENGINE_KEY];
		if (!(engine instanceof PermissionsEngine)) {
			return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Permissions module not installed');
		}

		const workspaceId = resolveWorkspaceId(ctx);
		if (!workspaceId) {
			return setApiResponse(HTTP.BAD_REQUEST, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		const allowed = await engine.can(ctx.user.id, operation, permissionKey, workspaceId);
		if (!allowed) {
			return setApiResponse(
				HTTP.FORBIDDEN,
				'FORBIDDEN',
				`Permission denied: ${operation}:${permissionKey}`,
			);
		}

		return next();
	};
}

export function requirePermission(operation: Operation, permissionKey: string): Middleware;
export function requirePermission(
	operation: Operation,
	permissionKey: string,
	ctx: IFonderieContext,
	next: () => Promise<Response>,
): Promise<Response>;
export function requirePermission(
	operation: Operation,
	permissionKey: string,
	ctx?: IFonderieContext,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	const handler = makeHandler(operation, permissionKey);
	if (ctx !== undefined && next !== undefined) return handler(ctx, next);
	return handler;
}

function resolveWorkspaceId(ctx: {
	workspace?: { id: string } | null;
	meta: Record<string, unknown>;
}): string | null {
	if (ctx.workspace?.id) return ctx.workspace.id;

	const params = ctx.meta['params'] as Record<string, string> | undefined;
	return params?.['workspaceId'] ?? null;
}
