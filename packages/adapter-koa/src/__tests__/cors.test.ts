import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cors } from '../index';

async function invoke(mw: ReturnType<typeof cors>, method: string, origin?: string) {
	const headers: Record<string, string> = {};
	let nextCalled = false;
	const ctx = {
		method,
		status: 200,
		request: { headers: origin ? { origin } : {} },
		set(k: string, v: string) {
			headers[k] = v;
		},
	};
	await mw(ctx as any, (async () => {
		nextCalled = true;
	}) as never);
	return { headers, ctx, nextCalled };
}

test('cors (koa): preflight gets 204 with the client header contract; the chain never runs', async () => {
	const out = await invoke(cors(), 'OPTIONS', 'http://localhost:5173');
	assert.equal(out.ctx.status, 204);
	assert.equal(out.nextCalled, false);
	const allow = out.headers['Access-Control-Allow-Headers'] ?? '';
	for (const h of ['X-Request-ID', 'traceparent', 'X-Workspace-ID', 'Content-Type', 'Authorization']) {
		assert.ok(allow.includes(h), `${h} must be allowed by default`);
	}
	assert.equal(out.headers['Access-Control-Expose-Headers'], 'X-Request-ID');
});

test('cors (koa): non-preflight sets headers and continues the chain', async () => {
	const out = await invoke(cors(), 'GET', 'http://localhost:5173');
	assert.equal(out.nextCalled, true);
	assert.ok((out.headers['Access-Control-Allow-Headers'] ?? '').includes('X-Request-ID'));
});

test('cors (koa): credentialed setup needs an explicit origin, then emits the pair', async () => {
	assert.throws(() => cors({ credentials: true }), /origin/);
	const out = await invoke(
		cors({ credentials: true, origin: 'http://localhost:5173' }),
		'OPTIONS',
		'http://localhost:5173',
	);
	assert.equal(out.headers['Access-Control-Allow-Credentials'], 'true');
	assert.equal(out.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
});
