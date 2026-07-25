import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigEntry, IConfigRevision } from '../types';

const ENTRY_COLS = `
	key,
	value,
	environment,
	description,
	active,
	version,
	updated_by AS "updatedBy",
	updated_at AS "updatedAt"`;

const SELECT_ENTRY = `SELECT ${ENTRY_COLS} FROM fonderie_config`;

// Thrown when an optimistic-concurrency write loses the compare-and-swap: the
// entry's current version isn't the one the caller wrote against. The caller
// (or the CLI/LLM) should re-read the current value and retry — reject-and-retry
// is config's conflict policy (automation writers, no human draft to lose).
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

export async function listConfigEntries(
	environment: string | null,
	store: IStoreAdapter,
): Promise<IConfigEntry[]> {
	return environment
		? store.query<IConfigEntry>(
				`${SELECT_ENTRY} WHERE (environment = $1 OR environment = 'all') AND active = true ORDER BY key`,
				[environment],
			)
		: store.query<IConfigEntry>(`${SELECT_ENTRY} ORDER BY environment, key`);
}

export async function getConfigEntry(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<IConfigEntry | null> {
	const [row] = await store.query<IConfigEntry>(
		`${SELECT_ENTRY} WHERE key = $1 AND environment = $2`,
		[key, environment],
	);
	return row ?? null;
}

// Upsert a config entry, bumping the version and appending a revision. When
// `ifVersion` is supplied, the write is guarded by optimistic concurrency —
// it commits only if the current version matches, else throws
// `ConfigConflictError`. Without `ifVersion` it's a plain (still-versioned)
// upsert. `actor` is recorded on the row and the revision.
export async function setConfigEntry(
	opts: {
		key: string;
		value: unknown;
		environment?: string;
		description?: string;
		active?: boolean;
		ifVersion?: number;
		actor?: string;
	},
	store: IStoreAdapter,
): Promise<IConfigEntry> {
	const env = opts.environment ?? 'all';
	const raw = typeof opts.value === 'string' ? opts.value : JSON.stringify(opts.value);
	const active = opts.active ?? true;
	const actor = opts.actor ?? null;

	return store.transaction(async (tx) => {
		// Serialize all writers for this (key, environment) — even a *create*,
		// where FOR UPDATE has no row to lock (two concurrent creators would
		// otherwise both compute version 1 and collide on the UNIQUE constraint).
		// An advisory xact lock keys on the pair and auto-releases on commit.
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [opts.key, env]);

		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM fonderie_config WHERE key = $1 AND environment = $2 FOR UPDATE`,
			[opts.key, env],
		);
		const currentVersion = cur?.version ?? null;

		if (opts.ifVersion !== undefined && currentVersion !== opts.ifVersion) {
			throw new ConfigConflictError(opts.key, env, currentVersion, opts.ifVersion);
		}

		const version = (currentVersion ?? 0) + 1;

		const [row] = cur
			? await tx.query<IConfigEntry>(
					`UPDATE fonderie_config SET
						value = $3, version = $4,
						description = COALESCE($5, description), active = $6,
						updated_by = $7, updated_at = now()
					WHERE key = $1 AND environment = $2
					RETURNING ${ENTRY_COLS}`,
					[opts.key, env, raw, version, opts.description ?? null, active, actor],
				)
			: await tx.query<IConfigEntry>(
					`INSERT INTO fonderie_config (key, environment, value, version, description, active, updated_by)
					VALUES ($1, $2, $3, $4, $5, $6, $7)
					RETURNING ${ENTRY_COLS}`,
					[opts.key, env, raw, version, opts.description ?? null, active, actor],
				);

		await tx.query(
			`INSERT INTO fonderie_config_revisions (key, environment, value, version, actor)
			VALUES ($1, $2, $3, $4, $5)`,
			[opts.key, env, raw, version, actor],
		);

		if (!row) throw new Error('Failed to upsert config entry');
		return row;
	});
}

// Roll *forward* to a past value: writes the value from revision `toVersion` as
// a new version (k8s `rollout undo` — history is never rewritten).
export async function rollbackConfigEntry(
	opts: { key: string; environment?: string; toVersion: number; actor?: string },
	store: IStoreAdapter,
): Promise<IConfigEntry> {
	const env = opts.environment ?? 'all';
	const actor = opts.actor ?? null;

	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [opts.key, env]);

		const [target] = await tx.query<{ value: string }>(
			`SELECT value FROM fonderie_config_revisions
			 WHERE key = $1 AND environment = $2 AND version = $3`,
			[opts.key, env, opts.toVersion],
		);
		if (!target) {
			throw new Error(`config "${opts.key}" (${env}) has no revision ${opts.toVersion}`);
		}

		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM fonderie_config WHERE key = $1 AND environment = $2 FOR UPDATE`,
			[opts.key, env],
		);
		if (!cur) throw new Error(`config "${opts.key}" (${env}) does not exist`);
		const version = cur.version + 1;

		const [row] = await tx.query<IConfigEntry>(
			`UPDATE fonderie_config SET value = $3, version = $4, updated_by = $5, updated_at = now()
			 WHERE key = $1 AND environment = $2
			 RETURNING ${ENTRY_COLS}`,
			[opts.key, env, target.value, version, actor],
		);
		await tx.query(
			`INSERT INTO fonderie_config_revisions (key, environment, value, version, actor)
			 VALUES ($1, $2, $3, $4, $5)`,
			[opts.key, env, target.value, version, actor],
		);
		if (!row) throw new Error('rollback failed');
		return row;
	});
}

export async function listConfigRevisions(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<IConfigRevision[]> {
	return store.query<IConfigRevision>(
		`SELECT key, environment, value, version, actor, created_at AS "createdAt"
		 FROM fonderie_config_revisions
		 WHERE key = $1 AND environment = $2
		 ORDER BY version DESC`,
		[key, environment],
	);
}

export async function deleteConfigEntry(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ key: string }>(
		`DELETE FROM fonderie_config WHERE key = $1 AND environment = $2 RETURNING key`,
		[key, environment],
	);
	return rows.length > 0;
}
