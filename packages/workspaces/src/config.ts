export const MESSAGE_KEYS = {
	workspaceInvitation: 'workspace-invitation',
} as const;

export type WorkspacesMessageKey = typeof MESSAGE_KEYS[keyof typeof MESSAGE_KEYS];

export interface IWorkspacesConfig {
	// How long invitations are valid
	// Default: '7d'
	invitationTtl?: string

	// Default role assigned to invited members
	// Default: 'member'
	defaultRole?: string
}
