import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IWorkspacesConfig } from '../config';
import { isWorkspaceManager } from '../middlewares/require-manager';
import { permissionsEngine } from '../permissions-engine';

// What the signed-in member may do here, read ONCE by a client so it can show
// only the actions that will succeed — instead of re-deriving the server's
// rules from role names, which is how buttons end up answering 403.
export function accessController(store: IStoreAdapter, config: IWorkspacesConfig) {
	return {
		// The resources the app checks — the role editor's switch grid.
		async catalog(ctx: IFonderieContext): Promise<Response> {
			const engine = permissionsEngine(ctx);
			const catalog = (engine?.catalog ?? []).map((e) => ({
				key: e.key,
				operations: e.operations ?? ['create', 'read', 'update', 'delete'],
				label: e.label ?? e.key,
				description: e.description ?? '',
			}));
			return setApiResponse(HTTP.OK, 'PERMISSION_CATALOG_FETCHED', 'Permission catalog retrieved.', {
				catalog,
				declared: !!engine?.catalog,
			});
		},

		async mine(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			const ws = ctx.workspace as { id: string; ownerId?: string };
			const userId = ctx.user!.id;
			const engine = permissionsEngine(ctx);
			const [isManager, effective] = await Promise.all([
				isWorkspaceManager(store, config, userId, ws),
				engine ? engine.effective(userId, ws.id) : Promise.resolve(null),
			]);
			return setApiResponse(HTTP.OK, 'PERMISSIONS_FETCHED', 'Your permissions retrieved.', {
				isOwner: !!ws.ownerId && ws.ownerId === userId,
				isManager,
				isSuper: effective?.isSuper ?? false,
				permissions: effective?.permissions ?? {},
			});
		},
	};
}
