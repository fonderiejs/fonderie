export const MESSAGE_KEYS = {
	workspaceInvitation: 'workspace-invitation',
	// Told when the team changes around them (docs/INSIDER-THREAT-DESIGN.md,
	// Phase 2): a rogue manager's work does not go unnoticed for days.
	memberRemoved: 'workspace-member-removed',
	memberRemovedAlert: 'workspace-member-removed-alert',
	managerRemoved: 'workspace-manager-removed',
	// Handing a team over waits for the new owner (Phase 4): they are offered
	// it, and the previous owner hears when they accept.
	ownershipOffered: 'workspace-ownership-offered',
	ownershipAccepted: 'workspace-ownership-accepted',
	// Phase 5: the owner hears that someone was paused for deleting too fast.
	managerPaused: 'workspace-manager-paused',
	// Phase 6: the owner hears when someone else adds a webhook or cancels the plan.
	webhookCreatedAlert: 'workspace-webhook-created-alert',
	planCancelAlert: 'workspace-plan-cancel-alert',
} as const;

export type WorkspacesMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

export const EVENT_KEYS = {
	personalWorkspaceCreated: 'fonderie.workspace.personal.created',
	// The trail (docs/INSIDER-THREAT-DESIGN.md, Phase 1): one event after every
	// successful team, role, invitation and workspace change. Payload:
	// { workspaceId, userId: <who did it>, targetUserId?, roleId?, inviteId? } —
	// ids only, so it carries no personal data and survives account erasure.
	workspaceCreated: 'fonderie.workspace.created',
	workspaceUpdated: 'fonderie.workspace.updated',
	workspaceArchived: 'fonderie.workspace.archived',
	workspaceRestored: 'fonderie.workspace.restored',
	settingsUpdated: 'fonderie.workspace.settings.updated',
	memberRemoved: 'fonderie.workspace.member.removed',
	memberLeft: 'fonderie.workspace.member.left',
	memberRoleAdded: 'fonderie.workspace.member.role.added',
	memberRoleRemoved: 'fonderie.workspace.member.role.removed',
	managerSet: 'fonderie.workspace.manager.set',
	managerUnset: 'fonderie.workspace.manager.unset',
	// Phase 4: offered → accepted (transferred) | declined | withdrawn. On
	// transferred the actor is the NEW owner and targetUserId the previous one.
	ownershipOffered: 'fonderie.workspace.ownership.offered',
	ownershipTransferred: 'fonderie.workspace.ownership.transferred',
	ownershipDeclined: 'fonderie.workspace.ownership.declined',
	ownershipWithdrawn: 'fonderie.workspace.ownership.withdrawn',
	// Phase 5: the velocity brake paused someone (targetUserId) / the owner released them.
	managerPaused: 'fonderie.workspace.manager.paused',
	managerReleased: 'fonderie.workspace.manager.released',
	invitationCreated: 'fonderie.workspace.invitation.created',
	invitationCancelled: 'fonderie.workspace.invitation.cancelled',
	invitationResent: 'fonderie.workspace.invitation.resent',
	invitationAccepted: 'fonderie.workspace.invitation.accepted',
	roleCreated: 'fonderie.workspace.role.created',
	roleUpdated: 'fonderie.workspace.role.updated',
	roleDeleted: 'fonderie.workspace.role.deleted',
	roleRestored: 'fonderie.workspace.role.restored',
	roleBinPurged: 'fonderie.workspace.role.bin.purged',
	rolePermissionsSet: 'fonderie.workspace.role.permissions.set',
} as const;

// Events of OTHER bricks the owner is alerted to (Phase 6) — mirrored here so
// workspaces depends on neither: @fonderie/webhooks WEBHOOK_EVENTS.endpointCreated
// and @fonderie/billing EVENT_KEYS.subscriptionCancelRequested.
export const OWNER_ALERT_EVENTS = {
	webhookCreated: 'fonderie.webhook.endpoint.created',
	planCancelRequested: 'fonderie.billing.subscription.cancel_requested',
} as const;

export type WorkspacesEventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS];

export interface IWorkspacesConfig {
	// How long invitations are valid. Default: '7d'
	invitationTtl?: string;

	// Who may hit PRIVILEGED workspace routes (role CRUD, member/invitation
	// management, settings, archive). Default 'owner-or-admin': the workspace
	// owner or a holder of an active system role named in `managerRoles`.
	// 'any-member' restores the legacy behaviour where every member could
	// manage the workspace. Reads are never gated by this.
	management?: 'owner-or-admin' | 'any-member';

	// Email the people a team change is about (docs/INSIDER-THREAT-DESIGN.md,
	// Phase 2): whoever is removed or loses manager rights, the new owner, and
	// the owner when a manager removes someone. Default true. Route these
	// message keys in courier like the invitation.
	teamNotices?: boolean;

	// Handing the team over asks for a fresh proof it's the owner (POST
	// /auth/step-up, @fonderie/auth 7.27+). Default true; false turns it off.
	stepUp?: boolean;

	// The velocity brake (Phase 5): someone other than the owner who makes
	// `limit` destructive changes in `windowMinutes` (default 10 in 10) is paused
	// from deleting until the owner releases them. false turns it off.
	velocityBrake?: { limit?: number; windowMinutes?: number } | false;

	// System-role NAMES that count as managers (default ['ADMIN']). Matched
	// only against is_system roles — GUEST is also a system role and must not
	// manage, and a member-created local role named 'ADMIN' must grant nothing.
	managerRoles?: string[];

	// Link the invitation email points to, with `{token}` replaced by the
	// invitation's token — e.g. 'https://app.example.com/invite/{token}'. The
	// page (or the app, via a universal / app link) signs the person in or up and
	// accepts with POST /workspaces/invitations/accept { token }. Unset: the
	// email carries the 6-digit PIN only.
	invitationUrl?: string;

	// Which account may accept an invitation LINK (the PIN is always bound to
	// the invited email). Default 'email-when-present': an account with an
	// email must be the invited one (else 403 INVITATION_EMAIL_MISMATCH, with a
	// masked hint of the right address) — a forwarded link or the wrong
	// signed-in account cannot join; an account with no email (phone sign-up)
	// accepts with the link, which only the invitee received. 'email' also
	// refuses accounts with no email; 'any' is the pre-6.7 behaviour.
	invitationAccountMatch?: 'email-when-present' | 'email' | 'any';

	// Auto-create a personal workspace when user.registered fires.
	// Requires an EventBus to be passed to WorkspacesModule. Default: true
	personalWorkspace?: boolean;

	// Override the HTTP path (and optionally method) of any workspace route, keyed
	// by a stable id — to match an existing frontend's contract without a shim.
	// The workspace id is resolved by `wsCtx` from the `:id` path param first, so
	// e.g. `{ updateWorkspace: '/workspaces/:id' }` maps a `PUT /workspaces/:id`
	// frontend onto Fonderie's header-based update with no glue. A bare string
	// overrides the path; an object can also change the method; unset = default.
	routes?: Partial<Record<WorkspaceRouteId, WorkspaceRouteOverride>>;
}

// Stable ids for every workspace route, for the `routes` override map.
export type WorkspaceRouteId =
	| 'createWorkspace' | 'listWorkspaces' | 'getWorkspace' | 'updateWorkspace'
	| 'archive' | 'restore' | 'getSettings' | 'updateSettings'
	| 'listMembers' | 'removeMember' | 'getMemberRoles' | 'addMemberRole' | 'removeMemberRole'
	| 'listInvitations' | 'invite' | 'cancelInvitation' | 'resendInvitation' | 'acceptInvitation'
	| 'getCurrentWorkspace' | 'getMyPermissions' | 'getPermissionCatalog' | 'leaveWorkspace' | 'transferOwnership' | 'setManager' | 'unsetManager'
	| 'releaseBrake'
	| 'getOwnershipOffer' | 'acceptOwnership' | 'declineOwnership' | 'withdrawOwnershipOffer'
	| 'createRole' | 'listRoles' | 'getRole' | 'updateRole' | 'removeRole' | 'getRolePermissions' | 'setRolePermissions'
	| 'listRoleBin' | 'restoreRole' | 'purgeRoleFromBin';

export type WorkspaceRouteOverride = string | { method?: string; path?: string };
