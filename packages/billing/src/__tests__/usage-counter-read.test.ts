import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { usageController } from '../controllers/usage.controller';
import { withBilling } from '../middlewares/billing';
import { MemoryCounterBackend } from '../backends/memory';

// GET /billing/usage/:metric used to sum usage RECORDS only, so a windowed plan
// limit (a counter withBilling keeps per request) always read 0. It now answers
// from the live counter for such a metric.

const WS = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const config = {
	provider: {},
	successUrl: 's',
	cancelUrl: 'c',
	plans: [
		{
			name: 'free',
			policy: {
				'api-calls': { limit: 5, buffer: 100, warnAt: 0.6, window: '1d' },
				jobs: { limit: 10 },
			},
		},
	],
} as unknown as IBillingConfig;

const store: IStoreAdapter = {
	query: async <T = unknown>(sql: string): Promise<T[]> =>
		(sql.includes('SUM(quantity)') ? [{ total: '7' }] : []) as T[],
	transaction: async (fn) => fn(store),
};

function ctx(metric: string): IFonderieContext {
	return {
		meta: { params: { metric } },
		user: { id: 'u-1', email: 'owner@acme.example' },
		workspace: { id: WS },
		tenant: null,
		request: new Request(`http://localhost/billing/usage/${metric}`),
	} as unknown as IFonderieContext;
}

async function read(backend: MemoryCounterBackend, metric: string) {
	const c = ctx(metric);
	// The real pipeline: withBilling counts this request, then the route reads.
	await withBilling(store, config, backend)(c, async () => new Response());
	const res = await usageController(store, config).get(c);
	return ((await res.json()) as { result: Record<string, unknown> }).result;
}

test('usage: a windowed plan limit reads the live counter for the current window', async () => {
	const backend = new MemoryCounterBackend();
	await read(backend, 'api-calls');
	await read(backend, 'api-calls');
	const r = await read(backend, 'api-calls');
	assert.equal(r['kind'], 'counter');
	assert.equal(r['total'], 3, 'three requests counted, this read included');
	assert.equal(r['limit'], 5);
	assert.equal(r['status'], 'warning'); // 3 >= 5 × 0.6
	assert.equal(r['window'], '1d');
	const since = Date.parse(r['since'] as string);
	assert.equal(since % 86_400_000, 0, 'window starts at 00:00 UTC');
	assert.equal(Date.parse(r['resetsAt'] as string) - since, 86_400_000);
});

test('usage: any other metric still sums usage records, with the plan limit if one exists', async () => {
	const r = await read(new MemoryCounterBackend(), 'jobs');
	assert.equal(r['kind'], 'records');
	assert.equal(r['total'], 7);
	assert.equal(r['limit'], 10);
	assert.equal(r['status'], null);
	const unknown = await read(new MemoryCounterBackend(), 'exports');
	assert.equal(unknown['kind'], 'records');
	assert.equal(unknown['limit'], null);
});
