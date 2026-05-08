export type Action   = string   // 'create' | 'read' | 'update' | 'delete' | '*'
export type Resource = string   // 'projects' | 'invoices' | '*'

export interface IPermission {
	action:   Action
	resource: Resource
}

export interface IRole {
	id:          string
	name:        string
	workspaceId: string
}

export interface IRoleWithPermissions extends IRole {
	permissions: IPermission[]
}

export interface IMembership {
	userId:      string
	workspaceId: string
	roleId:      string
	roleName:    string
}
