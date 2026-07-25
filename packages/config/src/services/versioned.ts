import type { IStoreAdapter } from '@fonderie/store';

// The control-plane primitive: version index + optimistic concurrency +
// advisory-locked writes + append-only revisions + push-notify, shared by every
// versioned admin resource. `config` and `secrets` are the first two adopters;
// a new resource is a table descriptor + its read shape away.

// Thrown when an optimistic-concurrency write loses the compare-and-swap. The
// caller re-reads the current value and retries (reject-and-retry).
export class ConfigConflictError extends Error {
	constructor(
		public readonly key: string,
		public readonly environment: string,
		public readonly currentVersion: number | null,
		public readonly expectedVersion: number,
	) {
		super(
			`config "${key}" (${environment}) is at version ${currentVersion ?? 'none'}, ` +
				`not ${expectedVersion} — reload and retry`,
		);
		this.name = 'ConfigConflictError';
	}
}

// A versioned resource's Postgres surface. `cols` is the RETURNING/SELECT column
// list that shapes this resource's rows (config exposes the value; secrets mask
// it) — passed in so the shared core stays resource-agnostic.
export interface IVersionedTable {
	table: string; // e.g. 'fonderie_config'
	revisions: string; // e.g. 'fonderie_config_revisions'
	channel: string; // e.g. 'fonderie_config_changed'
	cols: string; // RETURNING columns for this resource's read shape
}

// Write one versioned entry: advisory-lock the (key, env) pair (serializes even a
// create), enforce optimistic concurrency when `ifVersion` is given, bump the
// version, append a revision, and broadcast invalidation on commit. `rawValue`
// is already encoded by the caller (config JSON-stringifies; secrets encrypt).
export async function versionedWrite<T>(
	t: IVersionedTable,
	store: IStoreAdapter,
	opts: {
		key: string;
		environment: string;
		rawValue: string;
		description?: string | null;
		active: boolean;
		ifVersion?: number;
		actor: string | null;
	},
): Promise<T> {
	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
			opts.key,
			opts.environment,
		]);

		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM ${t.table} WHERE key = $1 AND environment = $2 FOR UPDATE`,
			[opts.key, opts.environment],
		);
		const currentVersion = cur?.version ?? null;
		if (opts.ifVersion !== undefined && currentVersion !== opts.ifVersion) {
			throw new ConfigConflictError(opts.key, opts.environment, currentVersion, opts.ifVersion);
		}
		const version = (currentVersion ?? 0) + 1;

		const params = [
			opts.key,
			opts.environment,
			opts.rawValue,
			version,
			opts.description ?? null,
			opts.active,
			opts.actor,
		];
		const [row] = cur
			? await tx.query<T>(
					`UPDATE ${t.table} SET
						value = $3, version = $4,
						description = COALESCE($5, description), active = $6,
						updated_by = $7, updated_at = now()
					WHERE key = $1 AND environment = $2
					RETURNING ${t.cols}`,
					params,
				)
			: await tx.query<T>(
					`INSERT INTO ${t.table} (key, environment, value, version, description, active, updated_by)
					VALUES ($1, $2, $3, $4, $5, $6, $7)
					RETURNING ${t.cols}`,
					params,
				);

		await tx.query(
			`INSERT INTO ${t.revisions} (key, environment, value, version, actor)
			VALUES ($1, $2, $3, $4, $5)`,
			[opts.key, opts.environment, opts.rawValue, version, opts.actor],
		);
		await tx.query(`SELECT pg_notify('${t.channel}', $1)`, [opts.environment]);

		if (!row) throw new Error(`Failed to write ${t.table} entry`);
		return row;
	});
}

// Roll *forward* to a past value: write revision `toVersion`'s value as a new
// version (k8s `rollout undo` — history is never rewritten).
export async function versionedRollback<T>(
	t: IVersionedTable,
	store: IStoreAdapter,
	opts: { key: string; environment: string; toVersion: number; actor: string | null },
): Promise<T> {
	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
			opts.key,
			opts.environment,
		]);

		const [target] = await tx.query<{ value: string }>(
			`SELECT value FROM ${t.revisions} WHERE key = $1 AND environment = $2 AND version = $3`,
			[opts.key, opts.environment, opts.toVersion],
		);
		if (!target) {
			throw new Error(`"${opts.key}" (${opts.environment}) has no revision ${opts.toVersion}`);
		}
		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM ${t.table} WHERE key = $1 AND environment = $2 FOR UPDATE`,
			[opts.key, opts.environment],
		);
		if (!cur) throw new Error(`"${opts.key}" (${opts.environment}) does not exist`);
		const version = cur.version + 1;

		const [row] = await tx.query<T>(
			`UPDATE ${t.table} SET value = $3, version = $4, updated_by = $5, updated_at = now()
			 WHERE key = $1 AND environment = $2
			 RETURNING ${t.cols}`,
			[opts.key, opts.environment, target.value, version, opts.actor],
		);
		await tx.query(
			`INSERT INTO ${t.revisions} (key, environment, value, version, actor)
			 VALUES ($1, $2, $3, $4, $5)`,
			[opts.key, opts.environment, target.value, version, opts.actor],
		);
		await tx.query(`SELECT pg_notify('${t.channel}', $1)`, [opts.environment]);

		if (!row) throw new Error('rollback failed');
		return row;
	});
}
