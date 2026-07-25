// The versioned-resource primitive now lives in @fonderie/store (pure Postgres
// machinery, reused by config, secrets, and courier templates). Re-exported here
// so config's internal imports are unchanged and `ConfigConflictError` stays a
// stable public name (an alias of the shared `VersionConflictError`).
export {
	versionedWrite,
	versionedRollback,
	VersionConflictError,
	VersionConflictError as ConfigConflictError,
} from '@fonderie/store';
export type { IVersionedResource } from '@fonderie/store';
