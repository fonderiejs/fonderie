import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cancelTrail } from '../middlewares/cancel-trail';

// Insider threat, Phase 6: a successful cancel names who did it and whether it
// ends now; a refused one says nothing.

const ctx = (body: unknown) =>
	({ user: { id: 'u-mgr' }, workspace: { id: 'ws-1' }, request: new Request('http://x/', { headers: { 'x-workspace-id': 'ws-1' } }), meta: { body } }) as never;

test('after a successful cancel: one event with the workspace, the actor and when it ends', async () => {
	const seen: Array<[string, Record<string, unknown>]> = [];
	const bus = { emit: async (t: string, p: unknown) => void seen.push([t, p as Record<string, unknown>]) };
	await cancelTrail(bus)(ctx({ atPeriodEnd: false }), async () => new Response('{}', { status: 200 }));
	assert.equal(seen.length, 1);
	assert.equal(seen[0]![0], 'fonderie.billing.subscription.cancel_requested');
	assert.equal(seen[0]![1]['userId'], 'u-mgr');
	assert.equal(seen[0]![1]['workspaceId'], 'ws-1');
	assert.equal(seen[0]![1]['atPeriodEnd'], false);
});

test('a refused cancel emits nothing', async () => {
	const seen: unknown[] = [];
	const bus = { emit: async (_t: string, p: unknown) => void seen.push(p) };
	await cancelTrail(bus)(ctx({ atPeriodEnd: false }), async () => new Response('{}', { status: 403 }));
	assert.deepEqual(seen, []);
});
