import { setApiResponse, HTTP, background } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { ICourierMessage } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';

import { getWorkspaceSettings } from '../services/workspaces';
import { MESSAGE_KEYS } from '../config';
import { InvitationModel } from '../models/invitation.model';
import { InvitationError } from '../services/invitations';
import { emailKey as accountKey } from '../services/email-key';
import type { InvitationAccountMatch } from '../services/invitations';
import { MemberModel } from '../models/member.model';
import { toInvitationDTO } from '../dtos/workspace';
import { seatLimitFromMeta } from '../services/seats';
import { PageRequestError, pageRequestOf } from '../services/paging';
import { listInvitationsPage } from '../services/invitations';

// Seat limits: see services/seats.ts (read from billing's ctx.meta, by shape).
const seatKey = (email: string): string => accountKey(email) ?? email.trim().toLowerCase();

export interface IInvitationControllerOptions {
	// See IWorkspacesConfig.invitationUrl.
	invitationUrl?: string;
	// See IWorkspacesConfig.invitationAccountMatch.
	invitationAccountMatch?: InvitationAccountMatch;
}

// Who the email says it is from, and which team: an invitation from an
// unnamed sender to an unnamed workspace reads like phishing.
async function inviteContext(store: IStoreAdapter, workspaceId: string, userId: string | undefined) {
	const [row] = await store.query<{ workspaceName: string | null; inviterName: string | null }>(
		`SELECT w.name AS "workspaceName",
		        NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), '') AS "inviterName"
		 FROM fonderie_workspaces w
		 LEFT JOIN fonderie_users u ON u.id = $2
		 WHERE w.id = $1`,
		[workspaceId, userId ?? null],
	);
	return { workspaceName: row?.workspaceName ?? '', inviterName: row?.inviterName ?? '' };
}

export function invitationController(
	store: IStoreAdapter,
	ttl: string,
	bus?: EventBus,
	options: IInvitationControllerOptions = {},
) {
	const invitations = new InvitationModel(store);
	const members = new MemberModel(store);

	const acceptUrl = (token: string) =>
		options.invitationUrl ? options.invitationUrl.replace('{token}', encodeURIComponent(token)) : '';

	const sendInvitationEmail = async (
		ctx: IFonderieContext,
		invitation: { email: string; token: string; pin: string | null },
	) => {
		const [who, settings] = await Promise.all([
			inviteContext(store, ctx.workspace!.id, ctx.user?.id),
			getWorkspaceSettings(ctx.workspace!.id, store),
		]);
		// No `locale`: the invitee's own account decides when they have one
		// (courier looks it up by address). Someone without an account yet gets
		// the business's language — a Quebec business invites in French — not
		// the system default.
		await background(bus
			?.emit(NOTIFICATION_EVENT, {
				type: MESSAGE_KEYS.workspaceInvitation,
				fallbackLocale: settings.locale,
				recipient: { email: invitation.email, phone: null, deviceToken: null },
				data: {
					token: invitation.token,
					pin: invitation.pin ?? '',
					acceptUrl: acceptUrl(invitation.token),
					workspaceName: who.workspaceName,
					inviterName: who.inviterName,
				},
			} satisfies ICourierMessage));
	};

	return {
		async list(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');

			// ?limit=&cursor= pages the list; without them it comes whole, as before.
			let page: ReturnType<typeof pageRequestOf>;
			try {
				page = pageRequestOf(ctx.request.url);
			} catch (err) {
				if (err instanceof PageRequestError) return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', err.message);
				throw err;
			}
			if (page) {
				const { invitations: rows, nextCursor } = await listInvitationsPage(ctx.workspace.id, store, page);
				return setApiResponse(HTTP.OK, 'INVITATIONS_FETCHED', 'Invitations retrieved successfully.', {
					invitations: rows.map(toInvitationDTO),
					nextCursor,
				});
			}
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

			// An EXPLICIT roleId must be one an invitation may target — the same
			// rule acceptance re-checks (assertRoleAssignable): a non-system role of
			// THIS workspace, or the least-privilege system GUEST default (naming
			// it explicitly is the same as omitting roleId). Without this, an
			// invitation smuggled an arbitrary role id — the system ADMIN, or
			// another workspace's role — straight into the membership on accept.
			const explicitRoleIds = [...new Set(
				entries.map((e) => e['roleId']).filter((r): r is string => typeof r === 'string'),
			)];
			if (explicitRoleIds.length > 0) {
				const rows = await store.query<{ id: string }>(
					`SELECT id FROM fonderie_roles
					 WHERE id = ANY($1)
					   AND ((workspace_id = $2 AND is_system = false)
					        OR (workspace_id IS NULL AND is_system = true AND name = 'GUEST'))`,
					[explicitRoleIds, ctx.workspace.id],
				);
				const assignable = new Set(rows.map((r) => r.id));
				const bad = explicitRoleIds.find((id) => !assignable.has(id));
				if (bad) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'INVALID_ROLE',
						'Role is not assignable in this workspace.',
					);
				}
			}

			// The seat check and the inserts run in ONE transaction that first locks
			// the workspace row: two managers inviting at once take turns, so both
			// cannot read "one seat left" and both insert (the plan ended a seat over,
			// N concurrent requests N-1 over). Emails go out after the commit.
			const outcome = await store.transaction(async (tx) => {
				await tx.query(`SELECT 1 FROM fonderie_workspaces WHERE id = $1 FOR UPDATE`, [ctx.workspace!.id]);
				const seatLimit = seatLimitFromMeta(ctx);
				if (seatLimit !== null) {
					// Seats already taken (each person once, plus pending invitations),
					// and how many of THIS request's addresses would take a new one — an
					// address already pending or already a member does not.
					const occupied = await new MemberModel(tx).countSeats(ctx.workspace!.id);
					const known = new Set(
						(await tx.query<{ email: string }>(
							`SELECT lower(email) AS email FROM fonderie_workspace_invitations
							 WHERE workspace_id = $1 AND status = 'PENDING' AND expires_at > now()
							 UNION
							 SELECT lower(u.email) FROM fonderie_role_user_workspaces ruw
							 JOIN fonderie_users u ON u.id = ruw.user_id
							 WHERE ruw.workspace_id = $1 AND ruw.removed = false AND u.email IS NOT NULL`,
							[ctx.workspace!.id],
						)).map((r) => seatKey(r.email)),
					);
					// Keyed like accounts (normalizeEmail), so inviting 'ana+crew@' when
					// 'ana@' is already a member takes no new seat.
					const adding = new Set(
						entries.map((e) => seatKey(String(e['email']))).filter((e) => !known.has(e)),
					).size;
					if (occupied + adding > seatLimit) return { refused: seatLimit } as const;
				}
				const txInvitations = new InvitationModel(tx);
				const created = [];
				for (const entry of entries) {
					created.push(await txInvitations.create({
						workspaceId: ctx.workspace!.id,
						email: entry['email'] as string,
						roleId: (entry['roleId'] as string | undefined) ?? defaultRoleId!,
						ttl,
					}));
				}
				return { created } as const;
			});
			if ('refused' in outcome) {
				return setApiResponse(
					HTTP.PAYMENT_REQUIRED,
					'SEAT_LIMIT_REACHED',
					`Your plan allows ${outcome.refused} seat${outcome.refused === 1 ? '' : 's'}. Upgrade to invite more members.`,
					{ limit: outcome.refused },
				);
			}
			const results = await Promise.all(
				outcome.created.map(async (invitation) => {
					await sendInvitationEmail(ctx, invitation);
					return { invitationId: invitation.id, email: invitation.email };
				}),
			);

			return setApiResponse(HTTP.CREATED, 'INVITATIONS_SENT', 'Invitations sent successfully.', {
				invitations: results,
			});
		},

		async resend(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.workspace) return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'Workspace not found');
			const params = ctx.meta['params'] as Record<string, string> | undefined;
			const invitationId = params?.['inviteId'];
			if (!invitationId)
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'inviteId is required');

			const invitation = await invitations.resend(invitationId, ctx.workspace.id, ttl);
			if (!invitation) {
				return setApiResponse(HTTP.NOT_FOUND, 'INVITATION_NOT_FOUND', 'No pending invitation with that id.');
			}
			await sendInvitationEmail(ctx, invitation);
			return setApiResponse(HTTP.OK, 'INVITATION_RESENT', 'Invitation sent again.', {
				invitation: toInvitationDTO(invitation),
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
			const token = body?.['token'];

			try {
				// Token path (32-byte secret from the email link) — also the route
				// for accounts without an email address (phone-registered users).
				if (typeof token === 'string') {
					const { workspaceId } = await invitations.acceptByToken(token, ctx.user!.id, {
						email: ctx.user!.email ?? null,
						...(options.invitationAccountMatch ? { match: options.invitationAccountMatch } : {}),
					});
					return setApiResponse(HTTP.OK, 'INVITATION_ACCEPTED', 'Invitation accepted successfully.', {
						workspaceId,
					});
				}

				if (typeof pin !== 'string') {
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'pin or token is required');
				}

				// PIN path — the 6-digit PIN only redeems an invitation addressed to
				// the ACCEPTING account's email (see acceptInvitationByPin).
				const email = ctx.user!.email;
				if (!email) {
					return setApiResponse(
						HTTP.BAD_REQUEST,
						'NO_EMAIL_ON_ACCOUNT',
						'This account has no email address — use the invitation link instead of the PIN',
					);
				}

				const { workspaceId } = await invitations.acceptByPin({ pin, userId: ctx.user!.id, email });
				return setApiResponse(HTTP.OK, 'INVITATION_ACCEPTED', 'Invitation accepted successfully.', {
					workspaceId,
				});
			} catch (err) {
				// Each refusal has its own reason (expired / used / revoked / wrong
				// account / role gone / not found); anything else is a real fault.
				if (err instanceof InvitationError) return setApiResponse(err.status, err.reason, err.message, err.details);
				throw err;
			}
		},
	};
}
