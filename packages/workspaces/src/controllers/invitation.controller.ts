import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { ICourierMessage }              from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { InvitationModel } from '../models/invitation.model';
import { toInvitationDTO } from '../dtos/workspace';

export function invitationController(store: IStoreAdapter, ttl: string) {
	const invitations = new InvitationModel(store)

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			const list = await invitations.list(ctx.workspace.id)
			return setApiResponse(HTTP.OK, 'INVITATIONS_FETCHED', 'Invitations retrieved successfully.', {
				invitations: list.map(toInvitationDTO),
			})
		},

		async invite(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			const body   = ctx.meta['body'] as Record<string, unknown> | undefined
			const email  = body?.['email']
			const roleId = body?.['roleId'] as string | undefined

			if (typeof email !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'email is required')
			}

			let resolvedRoleId = roleId
			if (!resolvedRoleId) {
				const [row] = await store.query<{ id: string }>(
					`SELECT id FROM fonderie_roles
					 WHERE name = 'ADMIN' AND workspace_id = $1 LIMIT 1`,
					[ctx.workspace.id],
				)
				resolvedRoleId = row?.id
			}

			if (!resolvedRoleId) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Default role not found')
			}

			const invitation = await invitations.create(
				{ workspaceId: ctx.workspace.id, email, roleId: resolvedRoleId, ttl },
			)

			ctx.meta['message'] = {
				type:      'workspace-invitation',
				recipient: { email, phone: null, deviceToken: null },
				data:      { token: invitation.token, pin: invitation.pin },
			} satisfies ICourierMessage

			return setApiResponse(HTTP.CREATED, 'INVITATION_SENT', 'Invitation sent successfully.', {
				invitationId: invitation.id,
			})
		},

		async cancel(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found')

			const params       = ctx.meta['params'] as Record<string, string> | undefined
			const invitationId = params?.['inviteId']

			if (!invitationId) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'inviteId is required')

			await invitations.cancel(invitationId, ctx.workspace.id)
			return setApiResponse(HTTP.OK, 'INVITATION_CANCELLED', 'Invitation cancelled successfully.')
		},

		async accept(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined
			const pin  = body?.['pin']

			if (typeof pin !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'pin is required')
			}

			try {
				const { workspaceId } = await invitations.acceptByPin({ pin, userId: ctx.user!.id })
				return setApiResponse(HTTP.OK, 'INVITATION_ACCEPTED', 'Invitation accepted successfully.', { workspaceId })
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Invalid invitation'
				return setApiResponse(HTTP.BAD_REQUEST, 'INVITATION_FAILED', message)
			}
		},
	}
}
