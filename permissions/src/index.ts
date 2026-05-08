// ── Public API ───────────────────────────────────────────────────
export type {
	IRole,
	Action,
	Resource,
	IPermission,
	IMembership,
	IRoleWithPermissions,
}                                                    from './types';
export { PermissionsModule }                         from './module';
export { PermissionsEngine, PermissionDeniedError }  from './engine';
export type { IPermissionsConfig }                   from './config';
export type { PermissionAction }                     from './constants';

// Middleware — imported directly for use in route definitions
export { PERMISSIONS }       from './constants';
export { requireRole }       from './middlewares/require-role';
export { requirePermission } from './middlewares/require-permission';
