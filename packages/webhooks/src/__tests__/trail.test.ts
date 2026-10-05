import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildWebhookRoutes } from '../routes';
import { WEBHOOK_EVENTS, hostOf } from '../middlewares/trail';

// Phase 6: the webhook trail records the URL's HOST only — a query string can
// carry a token — and only after a change succeeded.

test('hostOf keeps the host only', () => {
	assert.equal(hostOf('https://evil.acme.example/in?token=abc123secret'), 'evil.acme.example');
	assert.equal(hostOf('not a url'), undefined);
	assert.equal(hostOf(undefined), undefined);
});

test('a successful URL change emits endpoint.updated with the host — never the token; a refused one emits nothing', async () => {
	const seen: Array<[string, Record<string, unknown>]> = [];
	const bus = { emit: async (t: string, p: unknown) => void seen.push([t, p as Record<string, unknown>]), on() {} } as never;
	const route = buildWebhookRoutes({ query: async () => [] } as never, {}, bus).find(([m, p]) => m === 'PATCH' && p === '/webhooks/:endpointId')!;
	const trail = route[route.length - 2] as (ctx: unknown, next: () => Promise<Response>) => Promise<Response>;
	const ctx = {
		user: { id: 'u-mgr' },
		workspace: { id: 'ws-1' },
		meta: { params: { endpointId: 'ep-1' }, body: { url: 'https://evil.acme.example/in?token=abc123secret' } },
	};
	await trail(ctx, async () => new Response('{}', { status: 422 }));
	assert.deepEqual(seen, [], 'refused: nothing');
	await trail(ctx, async () => new Response('{"result":{}}', { status: 200 }));
	assert.equal(seen.length, 1);
	assert.equal(seen[0]![0], WEBHOOK_EVENTS.endpointUpdated);
	assert.deepEqual(seen[0]![1], { workspaceId: 'ws-1', userId: 'u-mgr', endpointId: 'ep-1', host: 'evil.acme.example' });
	assert.ok(!JSON.stringify(seen).includes('abc123secret'));
});
