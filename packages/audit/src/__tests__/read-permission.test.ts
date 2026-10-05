import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildAuditRoutes } from '../routes';

// I1 (docs/INSIDER-THREAT-DESIGN.md): who may read the workspace's trail.

const store = { query: async () => [] } as never;
const next = async () => new Response(null, { status: 200 });
const ctx = (can?: boolean) => ({
	user: { id: 'u-1' },
	workspace: { id: 'ws-1' },
	meta: can === undefined ? {} : { 'fonderie.permissions.engine': { can: async () => can } },
});

test('with a permission configured: read needs it, and a missing permissions module refuses', async () => {
	const route = buildAuditRoutes(store, { permission: 'audit' }).find(([m, p]) => m === 'GET' && p === '/audit')!;
	const guard = route[3] as (c: unknown, n: () => Promise<Response>) => Promise<Response>;
	assert.equal((await guard(ctx(false), next)).status, 403);
	assert.equal((await guard(ctx(true), next)).status, 200);
	assert.equal((await guard(ctx(), next)).status, 500, 'fail closed');
});

test('without one, nothing changes (any member reads)', () => {
	const open = buildAuditRoutes(store).find(([m, p]) => m === 'GET' && p === '/audit')!;
	const guarded = buildAuditRoutes(store, { permission: 'audit' }).find(([m, p]) => m === 'GET' && p === '/audit')!;
	assert.equal(guarded.length - open.length, 1);
});
