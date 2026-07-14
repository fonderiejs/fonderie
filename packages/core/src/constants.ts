import type { Operation } from './types';

// CRUD operation names shared across modules. Canonical home is core so the
// adapters (which peer only on core) can re-export OPERATIONS without loading
// @fonderie/permissions; permissions re-exports it for backward compatibility.
export const OPERATIONS = {
	CREATE: 'create',
	READ: 'read',
	UPDATE: 'update',
	DELETE: 'delete',
} as const satisfies Record<string, Operation>;
