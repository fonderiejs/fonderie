export interface IWorkspacesConfig {
	// How long invitations are valid
	// Default: '7d'
	invitationTtl?: string

	// Default role assigned to invited members
	// Default: 'member'
	defaultRole?: string
}
