export const MESSAGE_KEYS = {
	workspaceInvitation: 'workspace-invitation',
} as const;

export type WorkspacesMessageKey = (typeof MESSAGE_KEYS)[keyof typeof MESSAGE_KEYS];

export const EVENT_KEYS = {
	personalWorkspaceCreated: 'fonderie.workspace.personal.created',
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

	// System-role NAMES that count as managers (default ['ADMIN']). Matched
	// only against is_system roles — GUEST is also a system role and must not
	// manage, and a member-created local role named 'ADMIN' must grant nothing.
	managerRoles?: string[];

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
	| 'listInvitations' | 'invite' | 'cancelInvitation' | 'acceptInvitation'
	| 'createRole' | 'listRoles' | 'getRole' | 'updateRole' | 'removeRole' | 'getRolePermissions' | 'setRolePermissions';

export type WorkspaceRouteOverride = string | { method?: string; path?: string };
