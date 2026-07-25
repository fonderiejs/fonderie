import type { IStoreAdapter } from '@fonderie/store';

import type { ISecretEntry, ISecretRevision } from '../types';
import type { ISecretEncryptor } from '../crypto';
import { noopEncryptor } from '../crypto';
import type { IVersionedTable } from './versioned';
import { versionedWrite, versionedRollback } from './versioned';

// Metadata only — the value column is deliberately never selected here, so a
// secret's plaintext can't leak through admin list/get. Only `revealSecret`
// reads + decrypts the value.
const META_COLS = `
	key,
	environment,
	description,
	active,
	version,
	updated_by AS "updatedBy",
	updated_at AS "updatedAt"`;

const SECRET_TABLE: IVersionedTable = {
	table: 'fonderie_secrets',
	revisions: 'fonderie_secret_revisions',
	channel: 'fonderie_secrets_changed',
	cols: META_COLS, // masked — no value
};

export async function listSecrets(
	environment: string | null,
	store: IStoreAdapter,
): Promise<ISecretEntry[]> {
	return environment
		? store.query<ISecretEntry>(
				`SELECT ${META_COLS} FROM fonderie_secrets
				 WHERE (environment = $1 OR environment = 'all') AND active = true ORDER BY key`,
				[environment],
			)
		: store.query<ISecretEntry>(
				`SELECT ${META_COLS} FROM fonderie_secrets ORDER BY environment, key`,
			);
}

// Masked read — metadata, never the value.
export async function getSecret(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<ISecretEntry | null> {
	const [row] = await store.query<ISecretEntry>(
		`SELECT ${META_COLS} FROM fonderie_secrets WHERE key = $1 AND environment = $2`,
		[key, environment],
	);
	return row ?? null;
}

// The ONE path that returns a plaintext value — decrypts on the way out. Keep it
// behind the tightest authz; never log its result.
export async function revealSecret(
	key: string,
	environment: string,
	store: IStoreAdapter,
	encryptor: ISecretEncryptor = noopEncryptor,
): Promise<string | null> {
	const [row] = await store.query<{ value: string }>(
		`SELECT value FROM fonderie_secrets WHERE key = $1 AND environment = $2`,
		[key, environment],
	);
	return row ? encryptor.decrypt(row.value) : null;
}

// Write a secret — same versioned primitive as config, but the value is
// encrypted at rest and returned masked (metadata only).
export async function setSecret(
	opts: {
		key: string;
		value: string;
		environment?: string;
		description?: string;
		active?: boolean;
		ifVersion?: number;
		actor?: string;
	},
	store: IStoreAdapter,
	encryptor: ISecretEncryptor = noopEncryptor,
): Promise<ISecretEntry> {
	return versionedWrite<ISecretEntry>(SECRET_TABLE, store, {
		key: opts.key,
		environment: opts.environment ?? 'all',
		rawValue: encryptor.encrypt(opts.value),
		description: opts.description ?? null,
		active: opts.active ?? true,
		...(opts.ifVersion !== undefined ? { ifVersion: opts.ifVersion } : {}),
		actor: opts.actor ?? null,
	});
}

export async function rollbackSecret(
	opts: { key: string; environment?: string; toVersion: number; actor?: string },
	store: IStoreAdapter,
): Promise<ISecretEntry> {
	return versionedRollback<ISecretEntry>(SECRET_TABLE, store, {
		key: opts.key,
		environment: opts.environment ?? 'all',
		toVersion: opts.toVersion,
		actor: opts.actor ?? null,
	});
}

export async function listSecretRevisions(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<ISecretRevision[]> {
	return store.query<ISecretRevision>(
		`SELECT key, environment, version, actor, created_at AS "createdAt"
		 FROM fonderie_secret_revisions
		 WHERE key = $1 AND environment = $2
		 ORDER BY version DESC`,
		[key, environment],
	);
}

export async function deleteSecret(
	key: string,
	environment: string,
	store: IStoreAdapter,
): Promise<boolean> {
	const rows = await store.query<{ key: string }>(
		`DELETE FROM fonderie_secrets WHERE key = $1 AND environment = $2 RETURNING key`,
		[key, environment],
	);
	return rows.length > 0;
}
