import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { ICourierMessage }              from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import {
	createInvitation, listInvitations,
	cancelInvitation, acceptInvitationByPin,
} from '../services/invitations';
import { toInvitationDTO } from '../dtos/workspace';

export function listInvitationsHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const invitations = await listInvitations(ctx.workspace.id, store)
		return setApiResponse('INVITATIONS_FETCHED', 'Invitations retrieved successfully.', {
			invitations: invitations.map(toInvitationDTO),
		})
	}
}

export function inviteMemberHandler(store: IStoreAdapter, ttl: string) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const body   = ctx.meta['body'] as Record<string, unknown> | undefined
		const email  = body?.['email']
		const roleId = body?.['roleId'] as string | undefined

		if (typeof email !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'email is required', 422)
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
			return setErrorResponse('SERVER_ERROR', 'Default role not found', 500)
		}

		const invitation = await createInvitation(
			{ workspaceId: ctx.workspace.id, email, roleId: resolvedRoleId, ttl },
			store,
		)

		ctx.meta['message'] = {
			type:      'workspace-invitation',
			recipient: { email, phone: null, deviceToken: null },
			data:      { token: invitation.token, pin: invitation.pin },
		} satisfies ICourierMessage

		return setApiResponse('INVITATION_SENT', 'Invitation sent successfully.', {
			invitationId: invitation.id,
		}, 201)
	}
}

export function cancelInvitationHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.workspace) return setErrorResponse('NOT_FOUND', 'Workspace not found', 404)

		const params       = ctx.meta['params'] as Record<string, string> | undefined
		const invitationId = params?.['inviteId']

		if (!invitationId) return setErrorResponse('INVALID_PARAMETER', 'inviteId is required', 422)

		await cancelInvitation(invitationId, ctx.workspace.id, store)
		return setApiResponse('INVITATION_CANCELLED', 'Invitation cancelled successfully.')
	}
}

export function acceptInvitationHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)

		const body = ctx.meta['body'] as Record<string, unknown> | undefined
		const pin  = body?.['pin']

		if (typeof pin !== 'string') {
			return setErrorResponse('INVALID_PARAMETER', 'pin is required', 422)
		}

		try {
			const { workspaceId } = await acceptInvitationByPin({ pin, userId: ctx.user.id }, store)
			return setApiResponse('INVITATION_ACCEPTED', 'Invitation accepted successfully.', { workspaceId })
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Invalid invitation'
			return setErrorResponse('INVITATION_FAILED', message, 400)
		}
	}
}
