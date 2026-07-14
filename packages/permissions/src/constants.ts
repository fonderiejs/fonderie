import type { Operation } from './types';

// Canonical definition moved to @fonderie/core; re-exported here for back-compat.
export { OPERATIONS } from '@fonderie/core';

export const PERMISSION_COLUMN: Record<Operation, string> = {
	create: 'can_create',
	read: 'can_read',
	update: 'can_update',
	delete: 'can_delete',
};
