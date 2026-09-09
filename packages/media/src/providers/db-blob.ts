import type { IStoreAdapter } from '@fonderie/store';

import type { IFetched, IStorageProvider, IStoredRef } from './types';

/**
 * Zero-infra provider: bytes live in Postgres (`fonderie_media_blobs`, created by
 * this package's migration). Great for getting started and self-hosting — the
 * whole app is one Node process + one database, and a `pg_dump` captures the
 * images atomically with their metadata. Swap to `S3Provider` when bandwidth or
 * table size make object storage worth the extra moving part; no app code
 * changes, only the `MediaModule` config line.
 */
export class DbBlobProvider implements IStorageProvider {
	readonly name = 'db-blob';

	constructor(private readonly store: IStoreAdapter) {}

	async put({ bytes }: { bytes: Uint8Array; contentType: string }): Promise<IStoredRef> {
		const rows = await this.store.query<{ id: string }>(
			'INSERT INTO fonderie_media_blobs (bytes) VALUES ($1) RETURNING id',
			[Buffer.from(bytes)],
		);
		return { ref: rows[0]!.id };
	}

	async get(ref: string): Promise<IFetched | null> {
		const rows = await this.store.query<{ bytes: Buffer }>(
			'SELECT bytes FROM fonderie_media_blobs WHERE id = $1',
			[ref],
		);
		const row = rows[0];
		return row ? { kind: 'bytes', bytes: row.bytes } : null;
	}

	async delete(ref: string): Promise<void> {
		await this.store.query('DELETE FROM fonderie_media_blobs WHERE id = $1', [ref]);
	}
}
