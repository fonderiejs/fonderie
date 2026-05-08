export interface IWorkspace {
	id:          string
	name:        string
	slug:        string
	plan:        string
	ownerId:     string
	archivedAt:  Date | null
	createdAt:   Date
}

export interface IMember {
	id:          string
	userId:      string
	workspaceId: string
	roleId:      string
	roleName:    string
	createdAt:   Date
}

export interface IInvitation {
	id:          string
	workspaceId: string
	email:       string
	roleId:      string
	pin:         string
	expiresAt:   Date
	createdAt:   Date
}

export interface IRole {
	id:          string
	name:        string
	workspaceId: string
}
