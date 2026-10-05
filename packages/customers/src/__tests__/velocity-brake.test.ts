import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCustomerRoutes } from '../routes';

// Insider threat, Phase 5: deleting customers too fast pauses the person —
// the delete route carries @fonderie/workspaces' velocity brake.

test('a paused person cannot delete a customer (429 MANAGER_PAUSED); the owner is never braked', async () => {
	const store = { query: async () => [{ paused: true, recent: 0 }], transaction: async (fn: (t: unknown) => unknown) => fn(store) } as never;
	const route = buildCustomerRoutes(store, {}).find(([m, p]) => m === 'DELETE' && p === '/customers/:customerId')!;
	const brake = route[4] as (ctx: unknown, next: () => Promise<Response>) => Promise<Response>;
	const next = async () => new Response(null, { status: 200 });
	const ctx = (userId: string) => ({ user: { id: userId }, workspace: { id: 'ws', ownerId: 'owner' }, meta: {} });
	const res = await brake(ctx('manager'), next);
	assert.equal(res.status, 429);
	assert.equal(((await res.json()) as { reason: string }).reason, 'MANAGER_PAUSED');
	assert.equal((await brake(ctx('owner'), next)).status, 200);
});
