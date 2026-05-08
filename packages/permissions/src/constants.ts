import type { Operation } from './types'

export const OPERATIONS = {
	CREATE: 'create',
	READ:   'read',
	UPDATE: 'update',
	DELETE: 'delete',
} as const satisfies Record<string, Operation>

export const PERMISSION_COLUMN: Record<Operation, string> = {
	create: 'can_create',
	read:   'can_read',
	update: 'can_update',
	delete: 'can_delete',
}
