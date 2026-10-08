// ── Public API ───────────────────────────────────────────────────
export { sql } from './sql';
export type { ISqlQuery } from './sql';
export type { IStoreAdapter, IPoolConfig } from './types';
export {
	MigrationRunner,
	InternalMigrationRunner,
	createMigrationsPath,
	classifyMigration,
	assertUniqueMigrationNames,
	runMigrationSets,
} from './migrations';
export type {
	IMigrationClassification,
	MigrationImpact,
	MigrationSetInput,
} from './migrations';
export { PGAdapter, assertProductionDbConfig } from './adapters/pg';

// Versioned-resource control-plane primitive — version index + optimistic
// concurrency + advisory-locked writes + revisions + rollback + push-notify.
export { versionedWrite, versionedRollback, VersionConflictError } from './versioned';
export type { IVersionedResource } from './versioned';
