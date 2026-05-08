import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';
import {
	createWorkspace,
	findWorkspacesByUserId,
} from '../services/workspaces';
import { addMember }  from '../services/members';

export function listWorkspacesHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const workspaces = await findWorkspacesByUserId(ctx.user.id, store);
		return Response.json({ workspaces });
	}
}

export function createWorkspaceHandler(store: IStoreAdapter, defaultRole: string) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		const name = body?.['name'];

		if (typeof name !== 'string' || name.trim().length === 0) {
			return Response.json({ error: 'name is required' }, { status: 422 });
		}

		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

		// Ensure default 'owner' role exists for this workspace
		const workspace = await store.transaction(async tx => {
			const ws = await createWorkspace(
				{ name: name.trim(), slug, ownerId: ctx.user!.id },
				tx,
			);

			const [roleRows] = await Promise.all([
				// Create owner role
				tx.query<{ id: string }>(
					`INSERT INTO fonderie_roles (name, workspace_id)
					VALUES ('owner', $1)
					RETURNING id`,
					[ws.id],
				),
				// Also create member role
				tx.query(
					`INSERT INTO fonderie_roles (name, workspace_id)
					VALUES ('member', $1)`,
					[ws.id],
				),
			]);

			const ownerRoleId = roleRows[0]?.id
			if (!ownerRoleId) {
				throw new Error('Failed to create owner role');
			}

			// Add creator as owner
			await addMember(
				{ userId: ctx.user!.id, workspaceId: ws.id, roleId: ownerRoleId },
				tx,
			);

			return ws;
		});

		return Response.json({ workspace }, { status: 201 });
	}
}

export function getWorkspaceHandler() {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) {
			return Response.json({ error: 'Workspace not found' }, { status: 404 });
		}

		return Response.json({ workspace: ctx.workspace });
	}
}
