export const PERMISSIONS = {
	CREATE: 'create',
	READ:   'read',
	UPDATE: 'update',
	DELETE: 'delete',
	ALL:    '*',
} as const

export type PermissionAction = typeof PERMISSIONS[keyof typeof PERMISSIONS]
