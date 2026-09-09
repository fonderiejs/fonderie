import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeBase64, sniffImageType } from '../services/image';
import { LocalFsProvider } from '@fonderie/storage';
import { MediaModule } from '../module';
import { buildMediaRoutes } from '../routes';
import type { IMediaConfig } from '../config';

// A minimal PNG (magic bytes + padding) that passes the image sniff.
const PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');

function fakeProvider() {
	const calls = { put: 0, deleted: [] as string[] };
	const provider = {
		name: 'fake',
		put: async () => {
			calls.put++;
			return { ref: 'ref-1' };
		},
		get: async () => null,
		delete: async (r: string) => {
			calls.deleted.push(r);
		},
	};
	return { provider, calls };
}

// Grab the POST /media handler; call it directly (bypassing requireAuth).
function uploadHandler(config: IMediaConfig, store: unknown) {
	const routes = buildMediaRoutes(store as never, config);
	const route = routes.find((r) => r[0] === 'POST' && r[1] === '/media')!;
	return route[route.length - 1] as (ctx: unknown) => Promise<Response>;
}

const ctx = (body: Record<string, unknown>, userId = 'u1') =>
	({
		user: { id: userId },
		meta: { body, params: {} },
		request: new Request('http://localhost/v1/media', { method: 'POST' }),
	}) as unknown;

test('upload rejects an oversized base64 BEFORE decoding (no provider.put)', async () => {
	const { provider, calls } = fakeProvider();
	const handler = uploadHandler({ provider, maxBytes: 100 } as IMediaConfig, {});
	const res = await handler(ctx({ dataBase64: 'A'.repeat(300) })); // > 100 * 1.4
	assert.equal(res.status, 422);
	assert.equal((await res.json()).reason, 'ASSET_TOO_LARGE');
	assert.equal(calls.put, 0);
});

test('upload rejects a non-self owner by default (403, no provider.put)', async () => {
	const { provider, calls } = fakeProvider();
	const handler = uploadHandler({ provider } as IMediaConfig, {});
	const res = await handler(ctx({ dataBase64: PNG_B64, ownerType: 'user', ownerId: 'someone-else' }));
	assert.equal(res.status, 403);
	assert.equal(calls.put, 0);
});

test('upload cleans up the stored blob when the metadata insert fails', async () => {
	const { provider, calls } = fakeProvider();
	const store = { query: async () => { throw new Error('db down'); } };
	const handler = uploadHandler({ provider } as IMediaConfig, store);
	await assert.rejects(handler(ctx({ dataBase64: PNG_B64 })), /db down/);
	assert.equal(calls.put, 1); // bytes were stored…
	assert.deepEqual(calls.deleted, ['ref-1']); // …then cleaned up
});

test('authorizeOwner hook can permit a non-self owner', async () => {
	const { provider, calls } = fakeProvider();
	const store = { query: async () => [{ id: 'a1', owner_type: 'workspace', owner_id: 'w1', purpose: 'logo', content_type: 'image/png', byte_size: 12, storage_ref: 'ref-1', created_by: 'u1', created_at: new Date() }] };
	const handler = uploadHandler({ provider, authorizeOwner: () => true } as IMediaConfig, store);
	const res = await handler(ctx({ dataBase64: PNG_B64, ownerType: 'workspace', ownerId: 'w1', purpose: 'logo' }));
	assert.equal(res.status, 200);
	assert.equal(calls.put, 1);
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const SVG = new Uint8Array([...Buffer.from('<svg xmlns="...">')]);

test('sniffImageType recognises real images by magic bytes', () => {
	assert.equal(sniffImageType(PNG), 'image/png');
	assert.equal(sniffImageType(JPEG), 'image/jpeg');
	assert.equal(sniffImageType(WEBP), 'image/webp');
	assert.equal(sniffImageType(GIF), 'image/gif');
});

test('sniffImageType rejects SVG and unknown bytes (stored-XSS guard)', () => {
	assert.equal(sniffImageType(SVG), null);
	assert.equal(sniffImageType(new Uint8Array([1, 2, 3, 4])), null);
	assert.equal(sniffImageType(new Uint8Array([])), null);
});

test('decodeBase64 accepts a bare string and a data URI', () => {
	assert.equal(Buffer.from(decodeBase64('aGVsbG8=')).toString(), 'hello');
	assert.equal(Buffer.from(decodeBase64('data:image/png;base64,aGVsbG8=')).toString(), 'hello');
});

test('LocalFsProvider round-trips bytes and is delete-idempotent', async () => {
	const dir = `${process.env['TMPDIR'] ?? '/tmp'}/fonderie-media-test-${process.pid}`;
	const provider = new LocalFsProvider(dir);
	const { ref } = await provider.put({ bytes: PNG, contentType: 'image/png' });
	const got = await provider.get(ref);
	assert.equal(got?.kind, 'bytes');
	assert.deepEqual(got?.kind === 'bytes' ? Array.from(got.bytes) : null, Array.from(PNG));
	await provider.delete(ref);
	assert.equal(await provider.get(ref), null);
	await provider.delete(ref); // idempotent — no throw on a gone ref
});

test('LocalFsProvider refuses a path-traversal ref', async () => {
	const provider = new LocalFsProvider('/tmp/fonderie-media-guard');
	assert.equal(await provider.get('../../etc/passwd'), null); // get swallows the invalid ref
});

test('MediaModule advertises its name and auth dependency', () => {
	const mod = new MediaModule({} as never, { provider: new LocalFsProvider('/tmp/x') });
	assert.equal(mod.name, '@fonderie/media');
	assert.deepEqual(mod.deps, ['@fonderie/auth']);
});
