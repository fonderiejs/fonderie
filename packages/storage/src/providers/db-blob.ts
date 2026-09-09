import type { IStoreAdapter } from '@fonderie/store';

import type { IFetched, IStorageProvider, IStoredRef } from './types';

// Refs we mint are UUIDs. Guard reads/deletes so a foreign or malformed ref
// resolves to "not found" (null / no-op) instead of a Postgres
// "invalid input syntax for type uuid" error — the interface contract is
// null-on-missing, and a foundation provider shouldn't throw on a bad ref.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Zero-infra provider: bytes live in Postgres (`fonderie_storage_blobs`, created
 * by this package's migration). Great for getting started and self-hosting — the
 * whole app is one Node process + one database, and a `pg_dump` captures the
 * objects atomically with the rows that reference them. Swap to `S3Provider`
 * when bandwidth or table size make object storage worth the extra moving part;
 * no consumer code changes, only the provider passed in config.
 */
export class DbBlobProvider implements IStorageProvider {
	readonly name = 'db-blob';

	constructor(private readonly store: IStoreAdapter) {}

	async put({ bytes }: { bytes: Uint8Array; contentType: string }): Promise<IStoredRef> {
		const rows = await this.store.query<{ id: string }>(
			'INSERT INTO fonderie_storage_blobs (bytes) VALUES ($1) RETURNING id',
			[Buffer.from(bytes)],
		);
		return { ref: rows[0]!.id };
	}

	async get(ref: string): Promise<IFetched | null> {
		if (!UUID_RE.test(ref)) return null;
		const rows = await this.store.query<{ bytes: Buffer }>(
			'SELECT bytes FROM fonderie_storage_blobs WHERE id = $1',
			[ref],
		);
		const row = rows[0];
		return row ? { kind: 'bytes', bytes: row.bytes } : null;
	}

	async delete(ref: string): Promise<void> {
		if (!UUID_RE.test(ref)) return; // nothing to delete for a ref we never minted
		await this.store.query('DELETE FROM fonderie_storage_blobs WHERE id = $1', [ref]);
	}
}
