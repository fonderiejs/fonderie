export type {
	Operation,
	PermissionKey,
	IRole,
	IPermission,
	IMembership,
	IRoleWithPermissions,
} from './types';
export { PermissionsModule } from './module';
export { PermissionsEngine, PermissionDeniedError } from './engine';
export type { IPermissionsConfig } from './config';

export { OPERATIONS, PERMISSION_COLUMN } from './constants';
export { requireRole } from './middlewares/require-role';
export { requirePermission } from './middlewares/require-permission';

// Access-grant export for the SOC 2 access-review register.
export { listGrants } from './services/grants';
export type { IGrant } from './services/grants';
