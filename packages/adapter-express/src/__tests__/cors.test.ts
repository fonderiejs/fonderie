import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cors, type ExpressNext, type ExpressRequest, type ExpressResponse } from '../index';

function invoke(mw: ReturnType<typeof cors>, method: string, origin?: string) {
	const headers: Record<string, string> = {};
	let ended = false;
	let nextCalled = false;
	const res = {
		statusCode: 200,
		setHeader(k: string, v: string) {
			headers[k] = v;
		},
		end() {
			ended = true;
		},
	};
	mw(
		{ method, headers: origin ? { origin } : {} } as unknown as ExpressRequest,
		res as unknown as ExpressResponse,
		(() => {
			nextCalled = true;
		}) as ExpressNext,
	);
	return { headers, res, ended, nextCalled: () => nextCalled, endedNow: () => ended };
}

test('cors (express): preflight gets 204 with the client header contract; the chain never runs', () => {
	const out = invoke(cors(), 'OPTIONS', 'http://localhost:5173');
	assert.equal(out.res.statusCode, 204);
	assert.equal(out.endedNow(), true);
	assert.equal(out.nextCalled(), false);
	const allow = out.headers['Access-Control-Allow-Headers'] ?? '';
	for (const h of ['X-Request-ID', 'traceparent', 'X-Workspace-ID', 'Content-Type', 'Authorization']) {
		assert.ok(allow.includes(h), `${h} must be allowed by default`);
	}
	assert.equal(out.headers['Access-Control-Expose-Headers'], 'X-Request-ID');
});

test('cors (express): non-preflight sets headers and continues the chain', () => {
	const out = invoke(cors(), 'GET', 'http://localhost:5173');
	assert.equal(out.nextCalled(), true);
	assert.equal(out.endedNow(), false);
	assert.ok((out.headers['Access-Control-Allow-Headers'] ?? '').includes('X-Request-ID'));
});

test('cors (express): credentialed setup needs an explicit origin, then emits the pair', () => {
	assert.throws(() => cors({ credentials: true }), /origin/);
	const out = invoke(
		cors({ credentials: true, origin: 'http://localhost:5173' }),
		'OPTIONS',
		'http://localhost:5173',
	);
	assert.equal(out.headers['Access-Control-Allow-Credentials'], 'true');
	assert.equal(out.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
});
