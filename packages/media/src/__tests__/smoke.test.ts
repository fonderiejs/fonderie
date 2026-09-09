import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decodeBase64, sniffImageType } from '../services/image';
import { LocalFsProvider } from '../providers/local-fs';
import { MediaModule } from '../module';

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
