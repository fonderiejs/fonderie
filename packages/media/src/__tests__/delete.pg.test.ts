import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { DbBlobProvider } from '@fonderie/storage';
import type { IStorageProvider } from '@fonderie/storage';
import type { IStoreAdapter } from '@fonderie/store';

import { getMigrationsPath } from '../migrations';
import { buildMediaRoutes } from '../routes';

// DELETE /media/:id on a REAL Postgres with the DbBlob provider. The row and
// the bytes live in two stores that cannot commit together, so the order
// decides what a failure leaves: bytes with no row are harmless (nothing
// links to them), a row with no bytes is an asset that 404s forever.
// CI shares one database, so every row here belongs to fresh random ids.
//
//   MEDIA_PG_URL=postgres://... npm test -w @fonderie/media

const PG_URL = process.env['MEDIA_PG_URL'];
const skip = PG_URL ? false : 'set MEDIA_PG_URL to run';

let store: IStoreAdapter & { end?: () => Promise<void> };
let provider: DbBlobProvider;

before(async () => {
	if (!PG_URL) return;
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const { getMigrationsPath: storageMigrations } = await import('@fonderie/storage/migrations');
	store = new PGAdapter(PG_URL) as typeof store;
	await new InternalMigrationRunner(store, storageMigrations()).run();
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	provider = new DbBlobProvider(store);
});

after(async () => {
	if (!PG_URL) return;
	await store.end?.();
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

async function upload(createdBy: string) {
	const { ref } = await provider.put({ bytes: PNG, contentType: 'image/png' });
	const rows = await store.query<{ id: string }>(
		`INSERT INTO fonderie_media_assets
		   (owner_type, owner_id, purpose, content_type, byte_size, storage_ref, created_by)
		 VALUES ('user', $1, 'avatar', 'image/png', $2, $3, $1) RETURNING id`,
		[createdBy, PNG.byteLength, ref],
	);
	return { id: rows[0]!.id, ref };
}

const rowExists = async (id: string) =>
	(await store.query('SELECT 1 FROM fonderie_media_assets WHERE id = $1', [id])).length > 0;
const blobExists = async (ref: string) =>
	(await store.query('SELECT 1 FROM fonderie_storage_blobs WHERE id = $1', [ref])).length > 0;

function route(s: IStoreAdapter, p: IStorageProvider, method: 'GET' | 'DELETE') {
	const r = buildMediaRoutes(s, { provider: p }).find((x) => x[0] === method && x[1] === '/media/:id')!;
	const handler = r[r.length - 1] as (ctx: unknown) => Promise<Response>;
	return (id: string, userId?: string) =>
		handler({
			meta: { params: { id } },
			...(userId ? { user: { id: userId } } : {}),
			request: new Request(`http://localhost/media/${id}`, { method }),
		});
}

// The asset-row delete fails, the way a dropped connection would.
function rowDeleteFails(inner: IStoreAdapter): IStoreAdapter {
	const wrap = (s: IStoreAdapter): IStoreAdapter => ({
		async query<T>(sql: string, params?: unknown[]) {
			if (/DELETE FROM fonderie_media_assets/.test(sql)) throw new Error('connection lost');
			return s.query<T>(sql, params);
		},
		transaction: (fn) => s.transaction((tx) => fn(wrap(tx))),
	});
	return wrap(inner);
}

test('the row delete fails: the asset is still whole and still served — not a link that 404s forever', {
	skip,
}, async () => {
	const userId = randomUUID();
	const a = await upload(userId);
	await route(rowDeleteFails(store), provider, 'DELETE')(a.id, userId).catch(() => undefined);

	if (await rowExists(a.id)) {
		assert.ok(await blobExists(a.ref), 'the row survived but its bytes are gone');
		assert.equal((await route(store, provider, 'GET')(a.id)).status, 200);
	}
	// The retry, with the database back, finishes the job.
	const res = await route(store, provider, 'DELETE')(a.id, userId);
	assert.equal(res.status, 200);
	assert.equal(await rowExists(a.id), false);
	assert.equal(await blobExists(a.ref), false);
});

test('the byte delete fails: the asset is gone (200), only an unreachable blob is left', { skip }, async () => {
	const userId = randomUUID();
	const a = await upload(userId);
	const flaky: IStorageProvider = {
		name: 'flaky',
		put: (i) => provider.put(i),
		get: (r) => provider.get(r),
		delete: async () => {
			throw new Error('bucket unreachable');
		},
	};
	const res = await route(store, flaky, 'DELETE')(a.id, userId);
	assert.equal(res.status, 200);
	assert.equal(await rowExists(a.id), false);
	assert.equal((await route(store, provider, 'GET')(a.id)).status, 404);
});

test('only the uploader may delete; a missing asset is 404', { skip }, async () => {
	const owner = randomUUID();
	const a = await upload(owner);
	const del = route(store, provider, 'DELETE');
	assert.equal((await del(a.id, randomUUID())).status, 403);
	assert.equal(await rowExists(a.id), true, "someone else's delete touched nothing");
	assert.equal(await blobExists(a.ref), true);
	assert.equal((await del(randomUUID(), owner)).status, 404);
});
