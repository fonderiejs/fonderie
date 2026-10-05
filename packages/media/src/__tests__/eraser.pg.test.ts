import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { DbBlobProvider } from '@fonderie/storage';
import type { IStorageProvider } from '@fonderie/storage';
import type { IStoreAdapter } from '@fonderie/store';

import { accountEraser } from '../eraser';
import { getMigrationsPath } from '../migrations';
import { MediaModule } from '../module';
import { buildMediaRoutes } from '../routes';

// The account-deletion eraser on a REAL Postgres with the DbBlob provider:
// the person's own assets lose their row AND their bytes (and stop being
// served); assets they uploaded for someone else stay, without their id.
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
const subject = (userId: string) => ({ userId, email: 'leaver@acme.example', phone: null });

async function storeAsset(
	p: IStorageProvider,
	a: { ownerType: string; ownerId: string; purpose: string; createdBy: string | null },
) {
	const { ref } = await p.put({ bytes: PNG, contentType: 'image/png' });
	const rows = await store.query<{ id: string }>(
		`INSERT INTO fonderie_media_assets
		   (owner_type, owner_id, purpose, content_type, byte_size, storage_ref, created_by)
		 VALUES ($1, $2, $3, 'image/png', $4, $5, $6) RETURNING id`,
		[a.ownerType, a.ownerId, a.purpose, PNG.byteLength, ref, a.createdBy],
	);
	return { id: rows[0]!.id, ref };
}

const assetRow = async (id: string) =>
	(
		await store.query<{ id: string; created_by: string | null }>(
			'SELECT id, created_by FROM fonderie_media_assets WHERE id = $1',
			[id],
		)
	)[0];

const blobCount = async (ref: string) =>
	(
		await store.query<{ n: number }>(
			'SELECT count(*)::int AS n FROM fonderie_storage_blobs WHERE id = $1',
			[ref],
		)
	)[0]!.n;

// The public GET /media/:id handler, called directly (it needs no auth).
function serve(id: string): Promise<Response> {
	const route = buildMediaRoutes(store, { provider }).find(
		(r) => r[0] === 'GET' && r[1] === '/media/:id',
	)!;
	const handler = route[route.length - 1] as (ctx: unknown) => Promise<Response>;
	return handler({
		meta: { params: { id } },
		request: new Request(`http://localhost/media/${id}`),
	});
}

test('an erased person: avatar row and bytes gone, no longer served; their upload for a workspace kept without them', { skip }, async () => {
	const userId = randomUUID();
	const workspaceId = randomUUID();
	const bystander = randomUUID();

	const avatar = await storeAsset(provider, { ownerType: 'user', ownerId: userId, purpose: 'avatar', createdBy: userId });
	const logo = await storeAsset(provider, { ownerType: 'workspace', ownerId: workspaceId, purpose: 'logo', createdBy: userId });
	const other = await storeAsset(provider, { ownerType: 'user', ownerId: bystander, purpose: 'avatar', createdBy: bystander });

	assert.equal((await serve(avatar.id)).status, 200, 'served before the erase');

	// Through the module, so the eraser uses the provider media stores with.
	const eraser = new MediaModule(store, { provider }).accountEraser();
	assert.equal(eraser.name, 'media');
	const result = await eraser.erase(subject(userId));

	assert.equal(result.erased, 1);
	assert.match(result.kept ?? '', /^1 asset\(s\) uploaded for another owner/);

	assert.equal(await assetRow(avatar.id), undefined, 'avatar row deleted');
	assert.equal(await blobCount(avatar.ref), 0, 'avatar bytes deleted');
	assert.equal((await serve(avatar.id)).status, 404, 'avatar no longer served');

	const kept = await assetRow(logo.id);
	assert.ok(kept, 'workspace logo kept');
	assert.equal(kept.created_by, null, 'uploader pseudonymized');
	assert.equal(await blobCount(logo.ref), 1, 'workspace logo bytes kept');
	assert.equal((await serve(logo.id)).status, 200, 'workspace logo still served');

	const untouched = await assetRow(other.id);
	assert.equal(untouched?.created_by, bystander, 'someone else untouched');
	assert.equal(await blobCount(other.ref), 1);
});

test('a second erase is a no-op: 0 erased, nothing kept, no error', { skip }, async () => {
	const userId = randomUUID();
	await storeAsset(provider, { ownerType: 'user', ownerId: userId, purpose: 'avatar', createdBy: userId });
	await storeAsset(provider, { ownerType: 'workspace', ownerId: randomUUID(), purpose: 'logo', createdBy: userId });
	const eraser = accountEraser(store, { provider });

	assert.equal((await eraser.erase(subject(userId))).erased, 1);
	assert.deepEqual(await eraser.erase(subject(userId)), { erased: 0 });
});

test('a blob already gone is tolerated: the row still goes', { skip }, async () => {
	const userId = randomUUID();
	const avatar = await storeAsset(provider, { ownerType: 'user', ownerId: userId, purpose: 'avatar', createdBy: userId });
	await provider.delete(avatar.ref); // bytes vanished before the purge ran

	const result = await accountEraser(store, { provider }).erase(subject(userId));
	assert.equal(result.erased, 1);
	assert.equal(await assetRow(avatar.id), undefined);
});

test('a storage failure restores the asset and throws, so the retry can still delete the bytes', { skip }, async () => {
	const userId = randomUUID();
	const avatar = await storeAsset(provider, { ownerType: 'user', ownerId: userId, purpose: 'avatar', createdBy: userId });
	const failing: IStorageProvider = {
		name: 'flaky',
		put: (i) => provider.put(i),
		get: (r) => provider.get(r),
		delete: async () => {
			throw new Error('bucket unreachable');
		},
	};

	await assert.rejects(accountEraser(store, { provider: failing }).erase(subject(userId)), /could not delete 1 of 1/);
	assert.ok(await assetRow(avatar.id), 'row restored for the retry');
	assert.equal(await blobCount(avatar.ref), 1);

	// The retry, with storage back, finishes the job.
	assert.equal((await accountEraser(store, { provider }).erase(subject(userId))).erased, 1);
	assert.equal(await assetRow(avatar.id), undefined);
	assert.equal(await blobCount(avatar.ref), 0);
});

test('a userId that is not a UUID erases nothing and does not throw', { skip }, async () => {
	assert.deepEqual(await accountEraser(store, { provider }).erase(subject('not-a-uuid')), { erased: 0 });
});
