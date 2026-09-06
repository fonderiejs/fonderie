import { test } from 'node:test';
import assert from 'node:assert/strict';

import { requireAdminToken, validateAdminToken } from '../middlewares/require-admin-token';
import type { IFonderieContext } from '../types';

function ctx(auth?: string): IFonderieContext {
	return { request: new Request('http://localhost/admin', auth ? { headers: { authorization: auth } } : {}) } as IFonderieContext;
}
const next = async () => new Response('ok');

test('requireAdminToken: 401 for missing / malformed / wrong (handler never runs); passes with the right token', async () => {
	const mw = requireAdminToken('the-real-admin-token-value');
	let called = false;
	const trackedNext = async () => {
		called = true;
		return new Response('ok');
	};

	assert.equal((await mw(ctx(), trackedNext)).status, 401, 'no header');
	assert.equal((await mw(ctx('the-real-admin-token-value'), trackedNext)).status, 401, 'no Bearer prefix');
	assert.equal((await mw(ctx('Bearer '), trackedNext)).status, 401, 'empty token');
	assert.equal((await mw(ctx('Bearer wrong'), trackedNext)).status, 401, 'wrong token');
	assert.equal(called, false, 'the guarded handler never runs on a failed check');

	const ok = await mw(ctx('Bearer the-real-admin-token-value'), trackedNext);
	assert.equal(await ok.text(), 'ok', 'correct token calls next');
	assert.equal(called, true);
});

test('requireAdminToken: missing and wrong tokens return the identical 401 (no oracle)', async () => {
	const mw = requireAdminToken('secret');
	const a = (await mw(ctx(), next)) as Response;
	const b = (await mw(ctx('Bearer nope'), next)) as Response;
	assert.equal(a.status, b.status);
	assert.deepEqual(await a.json(), await b.json());
});

test('validateAdminToken: unset → no problem; short + placeholder → error; strong → clean', async () => {
	assert.deepEqual(validateAdminToken(undefined, { module: '@fonderie/x' }), []);

	const short = validateAdminToken('too-short', { module: '@fonderie/x' });
	assert.equal(short.length, 1);
	assert.equal(short[0]!.severity, 'error');
	assert.match(short[0]!.message, /at least 32 characters/);

	// 32+ chars but a placeholder value.
	const placeholder = validateAdminToken('changeme-changeme-changeme-changeme', { module: '@fonderie/x' });
	assert.equal(placeholder.length, 1);
	assert.equal(placeholder[0]!.severity, 'error');
	assert.match(placeholder[0]!.message, /placeholder/);

	assert.deepEqual(
		validateAdminToken('S3cure-random-ops-token-9f3a1c7e2b8d40', { module: '@fonderie/x' }),
		[],
		'a strong non-placeholder token is clean',
	);
});
