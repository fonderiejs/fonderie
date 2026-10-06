import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { withBilling } from '../middlewares/billing';
import { MemoryCounterBackend } from '../backends/memory';

// An adapter runs the global middleware twice for a request that falls through
// to a fonderie-owned route: once in bridge(), again inside handle(). The
// second pass carries the first one's meta as `meta.bridged`; billing must
// reuse its context from there, or every such request counts twice against a
// windowed plan limit (a 1000/day plan enforcing ~500).

const WS_A = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';
const WS_B = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';

function config(metric: string, extra: Partial<IBillingConfig> = {}): IBillingConfig {
	return {
		provider: {} as IBillingConfig['provider'],
		plans: [{ name: 'free', policy: { [metric]: { limit: 1000, window: '1d' } } }],
		successUrl: 'https://acme.example/ok',
		cancelUrl: 'https://acme.example/cancel',
		...extra,
	} as IBillingConfig;
}

const store: IStoreAdapter = {
	// Every durable notice claim is the first (fonderie_billing_notices).
	query: async <T = unknown>(sql: string): Promise<T[]> =>
		(sql.includes('INSERT INTO fonderie_billing_notices') ? [{ claimed: 1 }] : []) as T[],
	transaction: async (fn) => fn(store),
};

function ctx(workspaceId: string | null, meta: Record<string, unknown> = {}): IFonderieContext {
	return {
		meta,
		user: { id: 'u-1', email: 'member@acme.example' },
		workspace: workspaceId ? { id: workspaceId } : null,
		tenant: null,
		request: new Request('http://localhost/v1/workspaces'),
	} as unknown as IFonderieContext;
}

const next = async () => new Response();

test('bridged: the second pass reuses the first pass context — one request counts once', async () => {
	const backend = new MemoryCounterBackend();
	const mw = withBilling(store, config('calls-a'), backend);

	const first = ctx(WS_A);
	await mw(first, next);
	const second = ctx(WS_A, { bridged: first.meta });
	await mw(second, next);

	assert.equal(await backend.get(`workspace:${WS_A}:calls-a`, 86_400_000), 1);
	assert.equal(second.meta['billing'], first.meta['billing'], 'the same context object');
});

test('bridged: control — without the bridged seed the same two passes count twice', async () => {
	// Proves the assertion above can fail: this is the behaviour being fixed.
	const backend = new MemoryCounterBackend();
	const mw = withBilling(store, config('calls-b'), backend);

	await mw(ctx(WS_A), next);
	await mw(ctx(WS_A), next);

	assert.equal(await backend.get(`workspace:${WS_A}:calls-b`, 86_400_000), 2);
});

test('bridged: a first pass for a different subscriber is not reused', async () => {
	const backend = new MemoryCounterBackend();
	const mw = withBilling(store, config('calls-c'), backend);

	const first = ctx(WS_A);
	await mw(first, next);
	const second = ctx(WS_B, { bridged: first.meta });
	await mw(second, next);

	assert.equal(await backend.get(`workspace:${WS_B}:calls-c`, 86_400_000), 1);
	assert.notEqual(second.meta['billing'], first.meta['billing']);
	assert.deepEqual((second.meta['billing'] as { subscriber: unknown }).subscriber, {
		type: 'workspace',
		id: WS_B,
	});
});

test('limit notices: a USER subscriber is notified through the bus, not left on meta.messages', async () => {
	// Nothing sends ctx.meta.messages, so a notice parked there is never
	// delivered. With a resolver and a bus, every subscriber type goes out.
	const sent: Array<{ type: string; recipient: { email: string | null } }> = [];
	const bus = {
		emit: async (event: string, payload: unknown) => {
			if (event === NOTIFICATION_EVENT) sent.push(payload as (typeof sent)[number]);
		},
	} as unknown as EventBus;
	const asked: Array<[string, string]> = [];
	const cfg = config('calls-d', {
		plans: [{ name: 'free', policy: { 'calls-d': { limit: 1, buffer: 5, window: '1d' } } }],
		notifications: { softHit: true },
		resolveRecipient: async (type, id) => {
			asked.push([type, id]);
			return { email: 'member@acme.example', phone: null, deviceToken: null };
		},
	} as Partial<IBillingConfig>);

	const c = ctx(null);
	await withBilling(store, cfg, new MemoryCounterBackend(), bus)(c, next);
	await new Promise((r) => setTimeout(r, 0));

	assert.deepEqual(asked, [['user', 'u-1']]);
	assert.equal(sent.length, 1);
	assert.equal(sent[0]!.type, 'billing.limit-reached');
	assert.equal(c.meta['messages'], undefined);
});
