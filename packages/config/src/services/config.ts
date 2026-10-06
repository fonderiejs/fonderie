import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigEntry, IConfigRevision } from '../types';
import type { IVersionedResource } from './versioned';
import { versionedWrite, versionedRollback } from './versioned';

// Re-exported for the public API (the shared primitive owns the class).
export { ConfigConflictError } from './versioned';

/** The shape of a config value, as a frontend reading it would see it. */
export type ConfigValueKind = 'text' | 'number' | 'on/off' | 'object' | 'list' | 'empty';

export function configValueKind(value: unknown): ConfigValueKind {
	if (typeof value === 'string') return 'text';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'boolean') return 'on/off';
	if (Array.isArray(value)) return 'list';
	if (value === null || value === undefined) return 'empty';
	return 'object';
}

// A save that would change an existing key's shape — on/off to text, a list to
// an object. Frontends read these values with a fallback of the expected type
// (useRemoteConfig('X', false)), so a silent change reads as a different setting: the
// text "no" is truthy. Refused unless the caller says it means it.
export class ConfigTypeChangeError extends Error {
	constructor(
		public readonly key: string,
		public readonly from: ConfigValueKind,
		public readonly to: ConfigValueKind,
	) {
		super(`"${key}" holds ${from}; saving ${to} would change what every reader gets. Send allowTypeChange: true to do it on purpose.`);
		this.name = 'ConfigTypeChangeError';
	}
}

// The column stores JSON-encoded text; the runtime read path (manager)
// parses it with a raw-string fallback. The admin surface must serve the
// same parsed shape — otherwise setConfig({a: 1}) reads back as the string
// '{"a":1}' and the shipped editor re-stringifies it into a degradation
// loop on every save.
export function withParsedValue<T extends { value: unknown }>(row: T): T {
	if (typeof row.value !== 'string') return row;
	try {
		return { ...row, value: JSON.parse(row.value) };
	} catch {
		return row;
	}
}

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
		/** Permit changing an existing key's value kind (e.g. on/off → text). */
		allowTypeChange?: boolean;
	},
	store: IStoreAdapter,
): Promise<IConfigEntry> {
	const environment = opts.environment ?? 'all';
	// ALWAYS JSON-encoded — text included. Text used to be stored raw, and the
	// reader parses with a raw-text fallback, so a text value that happened to
	// look like JSON changed type on the way back: "42" became a number, "true"
	// a boolean. Rows written the old way still read through that fallback.
	const rawValue = JSON.stringify(opts.value ?? null);
	const data: Record<string, unknown> = { value: rawValue, active: opts.active ?? true };
	if (opts.description !== undefined) data['description'] = opts.description;
	return store.transaction(async (tx) => {
		// The kind check runs under the same advisory lock versionedWrite takes
		// (it is re-entrant within a transaction). Checked before the lock, two
		// first writes of one key with different kinds both saw no row and both
		// saved — the second a silent type change.
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
			opts.key,
			environment,
		]);
		if (!opts.allowTypeChange) {
			const current = await getConfigEntry(opts.key, environment, tx);
			if (current) {
				const from = configValueKind(withParsedValue(current).value);
				const to = configValueKind(opts.value);
				if (from !== to) throw new ConfigTypeChangeError(opts.key, from, to);
			}
		}
		return versionedWrite<IConfigEntry>(CONFIG_TABLE, tx, {
			key: opts.key,
			scope: environment,
			data,
			...(opts.ifVersion !== undefined ? { ifVersion: opts.ifVersion } : {}),
			actor: opts.actor ?? null,
		});
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
	// Same signal as a write (R3): without it, other instances — and realtime
	// streams — only learned of a delete on the next poll. Sent inside the
	// transaction so it fires at commit, and only if a row was deleted.
	return store.transaction(async (tx) => {
		const rows = await tx.query<{ key: string }>(
			`DELETE FROM fonderie_config WHERE key = $1 AND environment = $2 RETURNING key`,
			[key, environment],
		);
		if (rows.length === 0) return false;
		await tx.query(`SELECT pg_notify('${CONFIG_TABLE.channel}', $1)`, [environment]);
		return true;
	});
}
