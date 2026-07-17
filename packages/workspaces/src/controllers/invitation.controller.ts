import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { ICourierMessage } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';

import { getPlanLimit } from '@fonderie/billing';
import { MESSAGE_KEYS } from '../config';
import { InvitationModel } from '../models/invitation.model';
import { toInvitationDTO } from '../dtos/workspace';

export function invitationController(store: IStoreAdapter, ttl: string, bus?: EventBus) {
	const invitations = new InvitationModel(store);

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const list = await invitations.list(ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'INVITATIONS_FETCHED', 'Invitations retrieved successfully.', {
				invitations: list.map(toInvitationDTO),
			});
		},

		async invite(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			if (ctx.workspace.isPersonal) {
				return setApiResponse(
					HTTP.FORBIDDEN,
					'FORBIDDEN',
					'Personal workspaces do not support invitations',
				);
			}

			const body = ctx.meta['body'] as unknown;
			const entries = Array.isArray(body) ? body as Record<string, unknown>[] : [body as Record<string, unknown>];

			if (!entries.length) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'at least one invite is required');
			}

			for (const entry of entries) {
				if (typeof entry?.['email'] !== 'string') {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'email is required for every invite');
				}
			}

			// Seat limit — enforced automatically when billing module is registered.
			// getPlanLimit reads from ctx.meta['billing'] (fail-open when billing absent).
			const seatLimit = getPlanLimit(ctx, 'seats');
			if (seatLimit !== null) {
				const [countRow] = await store.query<{ count: string }>(
					`SELECT COUNT(*) AS count FROM fonderie_role_user_workspaces
					 WHERE workspace_id = $1 AND removed = false AND suspended = false`,
					[ctx.workspace.id],
				);
				const total = parseInt(countRow!.count, 10);
				const occupied = ctx.workspace.isPersonal ? total : Math.max(0, total - 1);
				if (occupied + entries.length > seatLimit) {
					return setApiResponse(
						HTTP.PAYMENT_REQUIRED,
						'SEAT_LIMIT_REACHED',
						`Your plan allows ${seatLimit} seat${seatLimit === 1 ? '' : 's'}. Upgrade to invite more members.`,
						{ limit: seatLimit },
					);
				}
			}

			// Resolve default role once for entries that omit roleId.
			// Invitations must never default to a privileged role: fall back to
			// the seeded system GUEST role (least privilege). Granting anything
			// more requires an explicit roleId from GET /workspaces/roles.
			let defaultRoleId: string | undefined;
			const needsDefault = entries.some((e) => !e['roleId']);
			if (needsDefault) {
				const [row] = await store.query<{ id: string }>(
					`SELECT id FROM fonderie_roles
					 WHERE name = 'GUEST' AND workspace_id IS NULL AND is_system = true
					 LIMIT 1`,
				);
				defaultRoleId = row?.id;
				if (!defaultRoleId) {
					return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Default role not found');
				}
			}

			const results = await Promise.all(
				entries.map(async (entry) => {
					const email = entry['email'] as string;
					const resolvedRoleId = (entry['roleId'] as string | undefined) ?? defaultRoleId!;

					const invitation = await invitations.create({
						workspaceId: ctx.workspace!.id,
						email,
						roleId: resolvedRoleId,
						ttl,
					});

					bus
						?.emit(NOTIFICATION_EVENT, {
							type: MESSAGE_KEYS.workspaceInvitation,
							recipient: { email, phone: null, deviceToken: null },
							data: { token: invitation.token, pin: invitation.pin },
						} satisfies ICourierMessage)
						.catch(() => {});

					return { invitationId: invitation.id, email };
				}),
			);

			return setApiResponse(HTTP.CREATED, 'INVITATIONS_SENT', 'Invitations sent successfully.', {
				invitations: results,
			});
		},

		async cancel(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const invitationId = params?.['inviteId'];

			if (!invitationId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'inviteId is required');

			await invitations.cancel(invitationId, ctx.workspace.id);
			return setApiResponse(HTTP.OK, 'INVITATION_CANCELLED', 'Invitation cancelled successfully.');
		},

		async accept(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const pin = body?.['pin'];

			if (typeof pin !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'pin is required');
			}

			try {
				const { workspaceId } = await invitations.acceptByPin({ pin, userId: ctx.user!.id });
				return setApiResponse(HTTP.OK, 'INVITATION_ACCEPTED', 'Invitation accepted successfully.', {
					workspaceId,
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Invalid invitation';
				return setApiResponse(HTTP.BAD_REQUEST, 'INVITATION_FAILED', message);
			}
		},
	};
}
