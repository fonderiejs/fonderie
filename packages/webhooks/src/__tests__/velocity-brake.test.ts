import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildWebhookRoutes } from '../routes';

// Insider threat, Phase 5: deleting webhook endpoints too fast pauses the
// person — the delete route carries @fonderie/workspaces' velocity brake.

test('a paused person cannot delete an endpoint (429 MANAGER_PAUSED); the owner is never braked', async () => {
	const store = { query: async () => [{ paused: true, recent: 0 }], transaction: async (fn: (t: unknown) => unknown) => fn(store) } as never;
	const route = buildWebhookRoutes(store, {}).find(([m, p]) => m === 'DELETE' && p === '/webhooks/:endpointId')!;
	const brake = route[5] as (ctx: unknown, next: () => Promise<Response>) => Promise<Response>;
	const next = async () => new Response(null, { status: 204 });
	const ctx = (userId: string) => ({ user: { id: userId }, workspace: { id: 'ws', ownerId: 'owner' }, meta: {} });
	assert.equal((await brake(ctx('manager'), next)).status, 429);
	assert.equal((await brake(ctx('owner'), next)).status, 204);
});
