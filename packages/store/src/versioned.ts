import type { IStoreAdapter } from './types';

// The control-plane primitive: a version index + optimistic concurrency +
// advisory-locked writes + append-only revisions + push-notify, reusable by any
// resource identified by a (primary, scope) key pair. `@fonderie/config` (config
// + secrets) and `@fonderie/courier` (email templates) run on it; a new resource
// is a descriptor away. Lives in `store` because it's pure Postgres machinery
// and every package already depends on store (no cycles).

// Thrown when an optimistic-concurrency write loses the compare-and-swap: the
// row's current version isn't the one the caller wrote against. Reject-and-retry.
export class VersionConflictError extends Error {
	constructor(
		public readonly key: string,
		public readonly scope: string | null,
		public readonly currentVersion: number | null,
		public readonly expectedVersion: number,
	) {
		super(
			`"${key}" (${scope ?? 'base'}) is at version ${currentVersion ?? 'none'}, ` +
				`not ${expectedVersion} — reload and retry`,
		);
		this.name = 'VersionConflictError';
	}
}

// A versioned resource's Postgres surface.
export interface IVersionedResource {
	table: string; // main table, e.g. 'fonderie_config'
	revisions: string; // history table, e.g. 'fonderie_config_revisions'
	channel: string; // LISTEN/NOTIFY channel, e.g. 'fonderie_config_changed'
	// The (primary, scope) key pair — config: ['key','environment'], courier:
	// ['type','locale']. `scope` is null-safe (a NULL locale is the base).
	keyColumns: readonly [string, string];
	// Content columns — written AND snapshotted into revisions (config: ['value'];
	// courier: ['subject','html','text']).
	contentColumns: readonly string[];
	// Extra main-table columns, set only when supplied, never revisioned (config:
	// ['description','active']; courier: ['active']).
	metaColumns?: readonly string[];
	// SELECT/RETURNING column list shaping the caller's row type.
	returning: string;
}

const lockSql = `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`;

function keyMatch(r: IVersionedResource): string {
	const [id, scope] = r.keyColumns;
	return `${id} IS NOT DISTINCT FROM $1 AND ${scope} IS NOT DISTINCT FROM $2`;
}

// Write one versioned entry: advisory-lock the (key, scope) pair (serializes even
// a create), enforce optimistic concurrency when `ifVersion` is given, bump the
// version, append a revision (content columns only), and broadcast invalidation
// on commit. `data` supplies every content column and any meta columns to set.
export async function versionedWrite<T>(
	r: IVersionedResource,
	store: IStoreAdapter,
	opts: {
		key: string;
		scope: string | null;
		data: Record<string, unknown>;
		ifVersion?: number;
		actor: string | null;
	},
): Promise<T> {
	const [idCol, scopeCol] = r.keyColumns;
	const content = r.contentColumns;
	const meta = (r.metaColumns ?? []).filter((c) => c in opts.data);
	const contentVals = content.map((c) => opts.data[c] ?? null);
	const metaVals = meta.map((c) => opts.data[c] ?? null);

	return store.transaction(async (tx) => {
		await tx.query(lockSql, [opts.key, opts.scope ?? '']);

		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM ${r.table} WHERE ${keyMatch(r)} FOR UPDATE`,
			[opts.key, opts.scope],
		);
		const currentVersion = cur?.version ?? null;
		if (opts.ifVersion !== undefined && currentVersion !== opts.ifVersion) {
			throw new VersionConflictError(opts.key, opts.scope, currentVersion, opts.ifVersion);
		}
		const version = (currentVersion ?? 0) + 1;
		const writeVals = [opts.key, opts.scope, ...contentVals, ...metaVals, version, opts.actor];

		let row: T | undefined;
		if (cur) {
			const sets = [
				...content.map((c, i) => `${c} = $${3 + i}`),
				...meta.map((c, j) => `${c} = $${3 + content.length + j}`),
				`version = $${3 + content.length + meta.length}`,
				`updated_by = $${4 + content.length + meta.length}`,
				`updated_at = now()`,
			];
			[row] = await tx.query<T>(
				`UPDATE ${r.table} SET ${sets.join(', ')} WHERE ${keyMatch(r)} RETURNING ${r.returning}`,
				writeVals,
			);
		} else {
			const cols = [idCol, scopeCol, ...content, ...meta, 'version', 'updated_by'];
			const ph = cols.map((_, i) => `$${i + 1}`);
			[row] = await tx.query<T>(
				`INSERT INTO ${r.table} (${cols.join(', ')}) VALUES (${ph.join(', ')}) RETURNING ${r.returning}`,
				writeVals,
			);
		}

		const revCols = [idCol, scopeCol, ...content, 'version', 'actor'];
		const revPh = revCols.map((_, i) => `$${i + 1}`);
		await tx.query(
			`INSERT INTO ${r.revisions} (${revCols.join(', ')}) VALUES (${revPh.join(', ')})`,
			[opts.key, opts.scope, ...contentVals, version, opts.actor],
		);
		await tx.query(`SELECT pg_notify('${r.channel}', $1)`, [opts.scope ?? '']);

		if (!row) throw new Error(`Failed to write ${r.table} entry`);
		return row;
	});
}

// Roll *forward* to a past revision's content as a new version (rollout undo —
// history is never rewritten).
export async function versionedRollback<T>(
	r: IVersionedResource,
	store: IStoreAdapter,
	opts: { key: string; scope: string | null; toVersion: number; actor: string | null },
): Promise<T> {
	const [idCol, scopeCol] = r.keyColumns;
	const content = r.contentColumns;

	return store.transaction(async (tx) => {
		await tx.query(lockSql, [opts.key, opts.scope ?? '']);

		const [target] = await tx.query<Record<string, unknown>>(
			`SELECT ${content.join(', ')} FROM ${r.revisions} WHERE ${keyMatch(r)} AND version = $3`,
			[opts.key, opts.scope, opts.toVersion],
		);
		if (!target) {
			throw new Error(`"${opts.key}" (${opts.scope ?? 'base'}) has no revision ${opts.toVersion}`);
		}
		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM ${r.table} WHERE ${keyMatch(r)} FOR UPDATE`,
			[opts.key, opts.scope],
		);
		if (!cur) throw new Error(`"${opts.key}" (${opts.scope ?? 'base'}) does not exist`);
		const version = cur.version + 1;
		const contentVals = content.map((c) => target[c] ?? null);
		const writeVals = [opts.key, opts.scope, ...contentVals, version, opts.actor];

		const sets = [
			...content.map((c, i) => `${c} = $${3 + i}`),
			`version = $${3 + content.length}`,
			`updated_by = $${4 + content.length}`,
			`updated_at = now()`,
		];
		const [row] = await tx.query<T>(
			`UPDATE ${r.table} SET ${sets.join(', ')} WHERE ${keyMatch(r)} RETURNING ${r.returning}`,
			writeVals,
		);

		const revCols = [idCol, scopeCol, ...content, 'version', 'actor'];
		const revPh = revCols.map((_, i) => `$${i + 1}`);
		await tx.query(
			`INSERT INTO ${r.revisions} (${revCols.join(', ')}) VALUES (${revPh.join(', ')})`,
			writeVals.slice(0, 2 + content.length).concat(version, opts.actor),
		);
		await tx.query(`SELECT pg_notify('${r.channel}', $1)`, [opts.scope ?? '']);

		if (!row) throw new Error('rollback failed');
		return row;
	});
}
