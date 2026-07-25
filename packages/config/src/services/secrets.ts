import type { IStoreAdapter } from '@fonderie/store';

import type { ISecretEntry, ISecretRevision } from '../types';
import type { ISecretEncryptor } from '../crypto';
import { noopEncryptor } from '../crypto';
import { ConfigConflictError } from './config';

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

// Write a secret — same version index / optimistic concurrency / advisory-lock /
// revisions / push-notify machinery as config, but the value is encrypted at
// rest and returned masked (metadata only).
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
	const env = opts.environment ?? 'all';
	const enc = encryptor.encrypt(opts.value);
	const active = opts.active ?? true;
	const actor = opts.actor ?? null;

	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [opts.key, env]);

		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM fonderie_secrets WHERE key = $1 AND environment = $2 FOR UPDATE`,
			[opts.key, env],
		);
		const currentVersion = cur?.version ?? null;
		if (opts.ifVersion !== undefined && currentVersion !== opts.ifVersion) {
			throw new ConfigConflictError(opts.key, env, currentVersion, opts.ifVersion);
		}
		const version = (currentVersion ?? 0) + 1;

		const [row] = cur
			? await tx.query<ISecretEntry>(
					`UPDATE fonderie_secrets SET
						value = $3, version = $4,
						description = COALESCE($5, description), active = $6,
						updated_by = $7, updated_at = now()
					WHERE key = $1 AND environment = $2
					RETURNING ${META_COLS}`,
					[opts.key, env, enc, version, opts.description ?? null, active, actor],
				)
			: await tx.query<ISecretEntry>(
					`INSERT INTO fonderie_secrets (key, environment, value, version, description, active, updated_by)
					VALUES ($1, $2, $3, $4, $5, $6, $7)
					RETURNING ${META_COLS}`,
					[opts.key, env, enc, version, opts.description ?? null, active, actor],
				);

		await tx.query(
			`INSERT INTO fonderie_secret_revisions (key, environment, value, version, actor)
			VALUES ($1, $2, $3, $4, $5)`,
			[opts.key, env, enc, version, actor],
		);
		// Broadcast invalidation — payload is the env only, never the value.
		await tx.query(`SELECT pg_notify('fonderie_secrets_changed', $1)`, [env]);

		if (!row) throw new Error('Failed to upsert secret');
		return row;
	});
}

export async function rollbackSecret(
	opts: { key: string; environment?: string; toVersion: number; actor?: string },
	store: IStoreAdapter,
): Promise<ISecretEntry> {
	const env = opts.environment ?? 'all';
	const actor = opts.actor ?? null;

	return store.transaction(async (tx) => {
		await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [opts.key, env]);

		const [target] = await tx.query<{ value: string }>(
			`SELECT value FROM fonderie_secret_revisions
			 WHERE key = $1 AND environment = $2 AND version = $3`,
			[opts.key, env, opts.toVersion],
		);
		if (!target) {
			throw new Error(`secret "${opts.key}" (${env}) has no revision ${opts.toVersion}`);
		}
		const [cur] = await tx.query<{ version: number }>(
			`SELECT version FROM fonderie_secrets WHERE key = $1 AND environment = $2 FOR UPDATE`,
			[opts.key, env],
		);
		if (!cur) throw new Error(`secret "${opts.key}" (${env}) does not exist`);
		const version = cur.version + 1;

		const [row] = await tx.query<ISecretEntry>(
			`UPDATE fonderie_secrets SET value = $3, version = $4, updated_by = $5, updated_at = now()
			 WHERE key = $1 AND environment = $2
			 RETURNING ${META_COLS}`,
			[opts.key, env, target.value, version, actor],
		);
		await tx.query(
			`INSERT INTO fonderie_secret_revisions (key, environment, value, version, actor)
			 VALUES ($1, $2, $3, $4, $5)`,
			[opts.key, env, target.value, version, actor],
		);
		await tx.query(`SELECT pg_notify('fonderie_secrets_changed', $1)`, [env]);
		if (!row) throw new Error('rollback failed');
		return row;
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
