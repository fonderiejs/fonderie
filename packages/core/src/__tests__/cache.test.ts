import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cacheControlValue, withCache } from '../middlewares';

const run = (mw: ReturnType<typeof withCache>, res: Response) => mw({} as never, async () => res);

test('withCache: policy → Cache-Control; private by default; false → no-store', async () => {
	assert.equal((await run(withCache({ maxAge: 300 }), new Response('x'))).headers.get('cache-control'), 'private, max-age=300');
	assert.equal((await run(withCache({ maxAge: 60, scope: 'public' }), new Response('x'))).headers.get('cache-control'), 'public, max-age=60');
	assert.equal((await run(withCache(false), new Response('x'))).headers.get('cache-control'), 'no-store');
	assert.equal(cacheControlValue({ maxAge: -5.7 }), 'private, max-age=0', 'never negative, whole seconds');
});

test("withCache: keeps the handler's own Cache-Control, status and body", async () => {
	const own = new Response('body', { status: 201, headers: { 'cache-control': 'no-store', 'x-other': '1' } });
	const res = await run(withCache({ maxAge: 300 }), own);
	assert.equal(res.headers.get('cache-control'), 'no-store');
	const set = await run(withCache({ maxAge: 300 }), new Response('body', { status: 201, headers: { 'x-other': '1' } }));
	assert.equal(set.status, 201);
	assert.equal(set.headers.get('x-other'), '1');
	assert.equal(await set.text(), 'body');
});
