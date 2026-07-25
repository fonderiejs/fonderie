import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigEntry, IConfigRevision } from '../types';
import type { IVersionedResource } from './versioned';
import { versionedWrite, versionedRollback } from './versioned';

// Re-exported for the public API (the shared primitive owns the class).
export { ConfigConflictError } from './versioned';

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

const CONFIG_TABLE: IVersionedResource = {
	table: 'fonderie_config',
	revisions: 'fonderie_config_revisions',
	channel: 'fonderie_config_changed',
	keyColumns: ['key', 'environment'],
	contentColumns: ['value'],
	metaColumns: ['description', 'active'],
	returning: ENTRY_COLS,
};

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

// Upsert a config entry. When `ifVersion` is given, the write is guarded by
// optimistic concurrency (else `ConfigConflictError`). Values are JSON-encoded;
// version bump, revision, advisory lock and push-notify are the shared primitive.
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
	const rawValue = typeof opts.value === 'string' ? opts.value : JSON.stringify(opts.value);
	const data: Record<string, unknown> = { value: rawValue, active: opts.active ?? true };
	if (opts.description !== undefined) data['description'] = opts.description;
	return versionedWrite<IConfigEntry>(CONFIG_TABLE, store, {
		key: opts.key,
		scope: opts.environment ?? 'all',
		data,
		...(opts.ifVersion !== undefined ? { ifVersion: opts.ifVersion } : {}),
		actor: opts.actor ?? null,
	});
}

export async function rollbackConfigEntry(
	opts: { key: string; environment?: string; toVersion: number; actor?: string },
	store: IStoreAdapter,
): Promise<IConfigEntry> {
	return versionedRollback<IConfigEntry>(CONFIG_TABLE, store, {
		key: opts.key,
		scope: opts.environment ?? 'all',
		toVersion: opts.toVersion,
		actor: opts.actor ?? null,
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
