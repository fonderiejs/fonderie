import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { withBilling } from '../middlewares/billing';
import { MemoryCounterBackend } from '../backends/memory';
import { hasFeature, getPlanLimit } from '../helpers';

// Entitlements follow payment: a subscription row names its plan whatever its
// status, so features, limits and seats must come from the free plan once the
// subscription stops paying — and come back the moment it pays again.

const WS = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OWNER = { email: 'owner@acme.example', phone: null, deviceToken: null };

const PLANS = [
	{
		name: 'free',
		policy: { jobs: { limit: 10 }, seats: { limit: 1 }, analytics: { enabled: false } },
	},
	{
		name: 'pro',
		monthly: { amount: 1500n, priceId: 'price_pro_monthly' },
		policy: { jobs: { limit: null }, seats: { limit: 20 }, analytics: { enabled: true } },
	},
];

function config(extra: Partial<IBillingConfig> = {}): IBillingConfig {
	return {
		provider: {} as IBillingConfig['provider'],
		plans: PLANS,
		successUrl: 'https://acme.example/ok',
		cancelUrl: 'https://acme.example/cancel',
		...extra,
	} as IBillingConfig;
}

function storeWith(subscription: Record<string, unknown> | null): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			// Every durable notice claim is the first (fonderie_billing_notices).
			if (sql.includes('INSERT INTO fonderie_billing_notices')) return [{ claimed: 1 }] as T[];
			return (sql.includes('fonderie_subscriptions') && subscription ? [subscription] : []) as T[];
		},
		transaction: async (fn) => fn(store),
	};
	return store;
}

function sub(status: string, currentPeriodEnd: Date | null = new Date()): Record<string, unknown> {
	return {
		id: 's1',
		subscriberType: 'workspace',
		subscriberId: WS,
		plan: 'pro',
		interval: 'month',
		status,
		providerSubscriptionId: 'sub_1',
		currentPeriodEnd,
	};
}

function ctx(email = 'member@acme.example'): IFonderieContext {
	return {
		meta: {},
		user: { id: 'u-member', email },
		workspace: { id: WS },
		tenant: null,
		request: new Request('http://localhost/v1/jobs'),
	} as unknown as IFonderieContext;
}

async function run(cfg: IBillingConfig, subscription: Record<string, unknown> | null, bus?: EventBus) {
	const c = ctx();
	await withBilling(storeWith(subscription), cfg, new MemoryCounterBackend(), bus)(c, async () => new Response());
	return c;
}

const seats = (c: IFonderieContext) =>
	(c.meta['billing'] as { statuses: Record<string, { limit?: number }> }).statuses['seats']?.limit;

for (const status of ['active', 'trialing']) {
	test(`entitlements: a ${status} subscription gets its plan`, async () => {
		const c = await run(config(), sub(status));
		assert.equal(hasFeature(c, 'analytics'), true);
		assert.equal(getPlanLimit(c, 'jobs'), null);
		assert.equal(seats(c), 20);
		assert.equal((c.meta['billing'] as { plan: string }).plan, 'pro');
	});
}

for (const status of ['incomplete', 'incomplete_expired', 'unpaid', 'paused', 'past_due']) {
	test(`entitlements: a ${status} subscription (no grace) gets the free plan`, async () => {
		const c = await run(config(), sub(status));
		const billing = c.meta['billing'] as { plan: string; subscribedPlan: string; active: boolean };
		assert.equal(billing.active, false);
		assert.equal(billing.plan, 'free');
		assert.equal(billing.subscribedPlan, 'pro');
		assert.equal(hasFeature(c, 'analytics'), false);
		assert.equal(getPlanLimit(c, 'jobs'), 10);
		assert.equal(seats(c), 1);
	});
}

test('entitlements: past_due within the dunning grace keeps the plan; past it, the free plan', async () => {
	const cfg = config({ dunning: { graceDays: 7 } } as Partial<IBillingConfig>);
	const day = 86_400_000;

	const inGrace = await run(cfg, sub('past_due', new Date(Date.now() - 2 * day)));
	assert.equal(hasFeature(inGrace, 'analytics'), true);
	assert.equal(seats(inGrace), 20);

	const pastGrace = await run(cfg, sub('past_due', new Date(Date.now() - 8 * day)));
	assert.equal(hasFeature(pastGrace, 'analytics'), false);
	assert.equal(seats(pastGrace), 1);
});

test('entitlements: no subscription → the free plan (unchanged)', async () => {
	const c = await run(config(), null);
	assert.equal(hasFeature(c, 'analytics'), false);
	assert.equal(getPlanLimit(c, 'jobs'), 10);
});

// ── limit notices for a workspace go to the owner ─────────────────────────

const WINDOWED = [
	{ name: 'free', policy: { 'api-calls': { limit: 1, buffer: 5, window: '1d' } } },
];

test('limit notices: a workspace notice goes to resolveRecipient (the owner), not the requester', async () => {
	const sent: Array<{ type: string; recipient: { email: string | null } }> = [];
	const bus = {
		emit: async (event: string, payload: unknown) => {
			if (event === NOTIFICATION_EVENT) sent.push(payload as (typeof sent)[number]);
		},
	} as unknown as EventBus;
	const asked: Array<[string, string]> = [];
	const cfg = config({
		plans: WINDOWED,
		notifications: { softHit: true },
		resolveRecipient: async (type, id) => {
			asked.push([type, id]);
			return OWNER;
		},
	} as Partial<IBillingConfig>);

	const c = await run(cfg, null, bus);
	await new Promise((r) => setTimeout(r, 0));

	assert.deepEqual(asked, [['workspace', WS]]);
	assert.equal(sent.length, 1);
	assert.equal(sent[0]!.type, 'billing.limit-reached');
	assert.equal(sent[0]!.recipient.email, OWNER.email);
	assert.equal(c.meta['messages'], undefined, 'the requesting member is not emailed');
});

test('limit notices: without a resolver the requester is still told (pre-workspace path)', async () => {
	// A different counter key: the once-per-crossing dedup is process-wide.
	const plans = [{ name: 'free', policy: { exports: { limit: 1, buffer: 5, window: '1d' } } }];
	const cfg = config({ plans, notifications: { softHit: true } } as Partial<IBillingConfig>);
	const c = await run(cfg, null, { emit: async () => {} } as unknown as EventBus);
	const messages = c.meta['messages'] as Array<{ recipient: { email: string } }>;
	assert.equal(messages.length, 1);
	assert.equal(messages[0]!.recipient.email, 'member@acme.example');
});
