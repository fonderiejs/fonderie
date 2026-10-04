import type { Operation, IPermissionCatalogEntry } from './types';

export interface IPermissionsConfig {
	// When true, a permission of action='*' or resource='*' matches anything
	// Default: true
	wildcards?: boolean;

	// Super-admin role name — members with this role bypass all checks
	// Default: 'owner'
	superRole?: string;

	// Every resource the app checks with requirePermission, declared ONCE. The
	// role editor reads it (GET /workspaces/permissions/catalog), saving a role
	// refuses keys outside it, and the effective-permissions read lists exactly
	// these. Unset: no catalog — any key is accepted, as before.
	catalog?: IPermissionCatalogEntry[];

	// What each SYSTEM role (shared by every workspace — e.g. the GUEST role
	// invitees land on) may do, by resource. Read from config at check time, so
	// every workspace — existing ones included — has it immediately, and
	// changing it here changes it everywhere: no seeding, no backfill. The
	// super role needs no entry. Custom roles keep their stored grants.
	//   systemGrants: { GUEST: { jobs: ['read', 'update'], customers: ['read'] } }
	systemGrants?: Record<string, Record<string, Operation[]>>;
}
