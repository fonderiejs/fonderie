import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LocalFsProvider } from '../providers/local-fs';
import { S3Provider } from '../providers/s3';

const BYTES = new Uint8Array([1, 2, 3, 4, 5]);

test('LocalFsProvider round-trips arbitrary bytes and is delete-idempotent', async () => {
	const dir = `${process.env['TMPDIR'] ?? '/tmp'}/fonderie-storage-test-${process.pid}`;
	const provider = new LocalFsProvider(dir);
	const { ref } = await provider.put({ bytes: BYTES, contentType: 'application/octet-stream' });
	const got = await provider.get(ref);
	assert.equal(got?.kind, 'bytes');
	assert.deepEqual(got?.kind === 'bytes' ? Array.from(got.bytes) : null, Array.from(BYTES));
	await provider.delete(ref);
	assert.equal(await provider.get(ref), null);
	await provider.delete(ref); // idempotent — no throw on a gone ref
});

test('LocalFsProvider refuses a path-traversal ref', async () => {
	const provider = new LocalFsProvider('/tmp/fonderie-storage-guard');
	assert.equal(await provider.get('../../etc/passwd'), null);
});

test('S3Provider constructs (MinIO endpoint) and exposes the provider shape', () => {
	const p = new S3Provider({
		bucket: 'assets',
		endpoint: 'http://localhost:9000',
		accessKeyId: 'k',
		secretAccessKey: 's',
	});
	assert.equal(p.name, 's3');
	assert.equal(typeof p.put, 'function');
	assert.equal(typeof p.get, 'function');
	assert.equal(typeof p.delete, 'function');
});
