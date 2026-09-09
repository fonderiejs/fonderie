import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';

import type { IFetched, IStorageProvider, IStoredRef } from './types';

/**
 * Zero-infra provider: bytes live on the server's filesystem under `dir`. Useful
 * for a single-box deployment that wants images off the database without
 * standing up object storage. The `ref` is an opaque filename; the asset's
 * content type is tracked in `fonderie_media_assets`, so nothing about the
 * bytes-on-disk needs to encode it.
 *
 * (Serves inline through the app like `DbBlobProvider`. It has no CDN in front,
 * so at real scale prefer `S3Provider` — same interface, one config line.)
 */
export class LocalFsProvider implements IStorageProvider {
	readonly name = 'local-fs';
	private readonly dir: string;
	private ready: Promise<void> | null = null;

	constructor(dir: string) {
		this.dir = resolve(dir);
	}

	private ensureDir(): Promise<void> {
		if (!this.ready) this.ready = mkdir(this.dir, { recursive: true }).then(() => undefined);
		return this.ready;
	}

	// Reject any ref that isn't a bare id, so a ref can never escape `dir`
	// (path traversal). Ids we mint are UUIDs.
	private pathFor(ref: string): string {
		if (!/^[A-Za-z0-9_-]+$/.test(ref)) throw new Error('invalid media ref');
		return join(this.dir, ref);
	}

	async put({ bytes }: { bytes: Uint8Array; contentType: string }): Promise<IStoredRef> {
		await this.ensureDir();
		const ref = randomUUID();
		await writeFile(this.pathFor(ref), bytes);
		return { ref };
	}

	async get(ref: string): Promise<IFetched | null> {
		try {
			const bytes = await readFile(this.pathFor(ref));
			return { kind: 'bytes', bytes };
		} catch {
			return null; // ENOENT (or an invalid ref) → treated as not found
		}
	}

	async delete(ref: string): Promise<void> {
		await rm(this.pathFor(ref), { force: true }); // force → no throw when already gone
	}
}
