export const MESSAGE_KEYS = {
	workspaceInvitation: 'workspace-invitation',
} as const;

export type WorkspacesMessageKey = typeof MESSAGE_KEYS[keyof typeof MESSAGE_KEYS];

export const EVENT_KEYS = {
	personalWorkspaceCreated: 'workspace.personal.created',
} as const

export type WorkspacesEventKey = typeof EVENT_KEYS[keyof typeof EVENT_KEYS]

export interface IWorkspacesConfig {
	// How long invitations are valid. Default: '7d'
	invitationTtl?: string

	// Default role assigned to invited members. Default: 'member'
	defaultRole?: string

	// Auto-create a personal workspace when user.registered fires.
	// Requires an EventBus to be passed to WorkspacesModule. Default: true
	personalWorkspace?: boolean
}
