import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';
import type { ICourierMessage }  from '@fonderie-js/courier';

import { addMember }    from '../services/members';
import { createInvitation, acceptInvitation } from '../services/invitations';

export function inviteMemberHandler(store: IStoreAdapter, ttl: string) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) {
			return Response.json({ error: 'Workspace not found' }, { status: 404 });
		}

		const body   = ctx.meta['body'] as Record<string, unknown> | undefined
		const email  = body?.['email'];
		const roleId = body?.['roleId'];

		if (typeof email !== 'string') {
			return Response.json({ error: 'email is required' }, { status: 422 });
		}

		// Default to 'member' role if not specified
		let resolvedRoleId = roleId as string | undefined
		if (!resolvedRoleId) {
			const [row]= await store.query<{ id: string }>(
				`SELECT id FROM fonderie_roles
				WHERE name = 'member' AND workspace_id = $1`,
				[ctx.workspace.id],
			);

			resolvedRoleId = row?.id
		}

		if (!resolvedRoleId) {
			return Response.json({ error: 'Default role not found' }, { status: 500 });
		}

		const invitation = await createInvitation(
			{ workspaceId: ctx.workspace.id, email, roleId: resolvedRoleId, ttl },
			store,
		);

		// PIN is returned here so @fonderie-js/email can send it
		// In production, never expose the PIN in the API response
		ctx.meta['message'] = {
			type:      'workspace-invitation',
			recipient: { email, phone: null, deviceToken: null },
			data:      { pin: invitation.pin },
		} satisfies ICourierMessage

		return Response.json({ ok: true, invitationId: invitation.id }, { status: 201 });
	}
}

export function acceptInvitationHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		const email = body?.['email'];
		const pin   = body?.['pin'];

		if (typeof email !== 'string' || typeof pin !== 'string') {
			return Response.json({ error: 'email and pin are required' }, { status: 422 });
		}

		try {
			const { workspaceId } = await acceptInvitation(
				{ email, pin, userId: ctx.user.id },
				store,
			);

			return Response.json({ ok: true, workspaceId });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Invalid invitation';
			return Response.json({ error: message }, { status: 400 });
		}
	}
}
