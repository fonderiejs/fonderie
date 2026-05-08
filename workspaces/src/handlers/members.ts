import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { listMembers, removeMember } from '../services/members';

export function listMembersHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) {
			return Response.json({ error: 'Workspace not found' }, { status: 404 });
		}

		const members = await listMembers(ctx.workspace.id, store);

		return Response.json({ members });
	}
}

export function removeMemberHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) {
			return Response.json({ error: 'Workspace not found' }, { status: 404 });
		}

		const params = ctx.meta['params'] as Record<string, string> | undefined
		const userId = params?.['userId'];

		if (!userId) {
			return Response.json({ error: 'userId is required' }, { status: 422 });
		}

		// Prevent removing yourself
		if (userId === ctx.user?.id) {
			return Response.json({ error: 'Cannot remove yourself' }, { status: 400 });
		}

		await removeMember(userId, ctx.workspace.id, store);

		return Response.json({ ok: true });
	}
}
