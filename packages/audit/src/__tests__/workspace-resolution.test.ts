import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildAuditRoutes } from '../routes';

// GET /audit resolves the caller's workspace itself (X-Workspace-ID, membership
// verified). Before, it only read ctx.workspace, which nothing set: every
// request answered 422 MISSING_WORKSPACE in an app without its own middleware.

test('a workspace an app middleware already set is used as is — no lookup', async () => {
	let queried = 0;
	const store = { query: async () => { queried++; return []; } } as never;
	const route = buildAuditRoutes(store).find(([m, p]) => m === 'GET' && p === '/audit')!;
	const resolve = route[3] as (c: unknown, n: () => Promise<Response>) => Promise<Response>;
	const ctx = { user: { id: 'u-1' }, workspace: { id: 'ws-1' }, request: new Request('http://x/audit'), meta: {} };
	assert.equal((await resolve(ctx, async () => new Response(null, { status: 200 }))).status, 200);
	assert.equal(queried, 0);
});

test('otherwise it resolves X-Workspace-ID and checks membership: a non-member is refused, not 422', async () => {
	let queried = 0;
	const store = { query: async () => { queried++; return []; }, transaction: async (fn: (t: unknown) => unknown) => fn(store) } as never;
	const route = buildAuditRoutes(store).find(([m, p]) => m === 'GET' && p === '/audit')!;
	const resolve = route[3] as (c: unknown, n: () => Promise<Response>) => Promise<Response>;
	const ctx = {
		user: { id: 'u-1' },
		workspace: null,
		request: new Request('http://x/audit', { headers: { 'x-workspace-id': '11111111-1111-4111-8111-111111111111' } }),
		meta: {},
	};
	let reached = false;
	const res = await resolve(ctx, async () => { reached = true; return new Response(null, { status: 200 }); });
	assert.ok(queried > 0, 'it looked the workspace up');
	assert.equal(reached, false, 'a non-member does not reach the trail');
	assert.notEqual(res.status, 422);
});
