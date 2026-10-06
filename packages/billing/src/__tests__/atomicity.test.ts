import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { IFonderieContext } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import { NOTIFICATION_EVENT } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { MESSAGE_KEYS } from '../config';
import { MemoryCounterBackend } from '../backends/memory';
import { checkoutController } from '../controllers/checkout.controller';
import { walletController } from '../controllers/wallet.controller';
import { webhookController } from '../controllers/webhook.controller';
import { getMigrationsPath } from '../migrations';
import { findOrCreateRecordedCustomer } from '../services/provider-customers';
import { handleSubscriberDeleted, handleSubscriberRestored } from '../services/subscriber-lifecycle';
import { upsertSubscription } from '../services/subscriptions';

// Races between two writers of the same billing row, on a real PostgreSQL: a
// request that read a row and then wrote it back after a provider round trip,
// and whatever committed in between. Each test stages the interleaving that
// used to lose a write (or send an email twice) and asserts the survivor.
//
//   BILLING_PG_URL=postgres://... npm test -w @fonderie/billing

const PG_URL = process.env['BILLING_PG_URL'];
const skip = PG_URL ? false : 'set BILLING_PG_URL to run';

// This file's own subscribers: CI runs every suite against one database.
const UPGRADE = 'a7c1e000-0000-4000-8000-000000000001';
const NEWCHECKOUT = 'a7c1e000-0000-4000-8000-000000000002';
const WEBHOOK = 'a7c1e000-0000-4000-8000-000000000003';
const CUSTOMER = 'a7c1e000-0000-4000-8000-000000000004';
const PAYG = 'a7c1e000-0000-4000-8000-000000000005';
const NOTICE = 'a7c1e000-0000-4000-8000-000000000006';
const LIFECYCLE = 'a7c1e000-0000-4000-8000-000000000007';
const TRIAL = 'a7c1e000-0000-4000-8000-000000000008';
const ALL = [UPGRADE, NEWCHECKOUT, WEBHOOK, CUSTOMER, PAYG, NOTICE, LIFECYCLE, TRIAL];

async function connect() {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	for (const table of [
		'fonderie_subscriptions',
		'fonderie_billing_customers',
		'fonderie_wallet_customers',
		'fonderie_billing_notices',
		'fonderie_subscription_trials',
	]) {
		await store.query(`DELETE FROM ${table} WHERE subscriber_id = ANY($1::uuid[])`, [ALL]);
	}
	return store;
}

const close = (store: unknown) => (store as { end?: () => Promise<void> }).end?.();

function userCtx(id: string, body: Record<string, unknown> = {}, headers: HeadersInit = {}): IFonderieContext {
	return {
		meta: { body },
		user: { id, email: 'buyer@acme.example' },
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/billing', { method: 'POST', headers, body: '{}' }),
	} as unknown as IFonderieContext;
}

const plans = [
	{ name: 'starter', tier: 1, monthly: { priceId: 'price_starter_m' } },
	{ name: 'pro', tier: 2, monthly: { priceId: 'price_pro_m' } },
];

async function row(store: IStoreAdapter, id: string) {
	const [r] = await store.query<{ status: string; plan: string; sub: string | null }>(
		`SELECT status, plan, provider_subscription_id AS sub FROM fonderie_subscriptions
		 WHERE subscriber_type = 'user' AND subscriber_id = $1`,
		[id],
	);
	return r;
}

// What the provider's customer.subscription.* webhook writes.
function webhookWrite(store: IStoreAdapter, id: string, status: string, sub: string, plan = 'pro') {
	return upsertSubscription(
		{
			subscriberType: 'user',
			subscriberId: id,
			plan,
			status,
			providerCustomerId: 'cus_race',
			providerSubscriptionId: sub,
			providerEventAt: new Date(),
		},
		store,
	);
}

test('upgrade vs an immediate cancel: the terminal cancel survives the upgrade write-back', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await webhookWrite(store, UPGRADE, 'active', 'sub_up', 'starter');
		const provider = {
			name: 'fake',
			// While the upgrade is at the provider, DELETE /subscription (atPeriodEnd
			// false) ends it and the terminal deleted webhook commits.
			async updateSubscription() {
				await webhookWrite(store, UPGRADE, 'canceled', 'sub_up', 'free');
				return { status: 'active', currentPeriodStart: new Date(), currentPeriodEnd: new Date() };
			},
		};
		const res = await checkoutController(store, {
			provider,
			plans,
			successUrl: 'https://acme.example/ok',
			cancelUrl: 'https://acme.example/cancel',
		} as never).createSession(userCtx(UPGRADE, { plan: 'pro', interval: 'month' }));

		assert.equal((await row(store, UPGRADE))?.status, 'canceled', 'no paid access resurrected');
		assert.equal(res.status, 409, 'the caller is told the subscription ended, not that it upgraded');
	} finally {
		await close(store);
	}
});

test('new checkout vs a paid-session webhook: the live subscription is not orphaned', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await webhookWrite(store, NEWCHECKOUT, 'canceled', 'sub_dead');
		const provider = {
			name: 'fake',
			// The subscriber pays a session from another tab while this one is
			// being created; its webhook makes the row live.
			async createCheckoutSession() {
				await webhookWrite(store, NEWCHECKOUT, 'active', 'sub_live');
				return { url: 'https://checkout.acme.example/s' };
			},
		};
		const res = await checkoutController(store, {
			provider,
			plans,
			successUrl: 'https://acme.example/ok',
			cancelUrl: 'https://acme.example/cancel',
		} as never).createSession(userCtx(NEWCHECKOUT, { plan: 'pro', interval: 'month' }));

		const r = await row(store, NEWCHECKOUT);
		assert.equal(r?.status, 'active');
		assert.equal(r?.sub, 'sub_live', 'the provider subscription id is kept');
		assert.notEqual(res.status, 200, 'no second checkout URL for an already-live subscriber');
	} finally {
		await close(store);
	}
});

// Pauses each matching query's caller until `parties` callers reached it, or a
// timeout passes — so two deliveries interleave exactly where a race needs
// them to, and a correct lock (which keeps the second away) just costs a wait.
function rendezvous(inner: IStoreAdapter, match: RegExp, parties = 2, timeoutMs = 400): IStoreAdapter {
	let waiting: Array<() => void> = [];
	const gate = () =>
		new Promise<void>((resolve) => {
			waiting.push(resolve);
			if (waiting.length >= parties) {
				for (const r of waiting) r();
				waiting = [];
			} else {
				setTimeout(resolve, timeoutMs);
			}
		});
	const wrap = (s: IStoreAdapter): IStoreAdapter => ({
		async query<T>(sql: string, params?: unknown[]) {
			const rows = await s.query<T>(sql, params);
			if (match.test(sql)) await gate();
			return rows;
		},
		transaction: (fn) => s.transaction((tx) => fn(wrap(tx))),
	});
	return wrap(inner);
}

test('two concurrent deliveries of one deleted event send exactly ONE cancellation email', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await webhookWrite(store, WEBHOOK, 'active', 'sub_wh');
		const sent: string[] = [];
		const bus = {
			emit: async (event: string, payload: { type?: string }) => {
				if (event === NOTIFICATION_EVENT && payload.type) sent.push(payload.type);
			},
		} as unknown as EventBus;
		const eventAt = new Date(Date.now() + 1000);
		const event = {
			type: 'customer.subscription.deleted',
			eventAt,
			subscription: {
				subscriberType: 'user',
				subscriberId: WEBHOOK,
				plan: 'free',
				priceLookupKey: null,
				priceId: null,
				status: 'canceled',
				providerCustomerId: 'cus_race',
				providerSubscriptionId: 'sub_wh',
				currentPeriodStart: new Date(),
				currentPeriodEnd: new Date(),
				cancelAtPeriodEnd: false,
				trialEndsAt: null,
				interval: 'month',
			},
		};
		const config = {
			provider: { name: 'fake', constructEvent: async () => structuredClone(event) },
			webhookSecret: 'whsec_x',
			plans,
			resolveRecipient: async () => ({ email: 'buyer@acme.example', phone: null, deviceToken: null }),
		} as never;
		// Both deliveries read the subscription before either writes it.
		const raced = rendezvous(store, /SELECT[\s\S]*FROM fonderie_subscriptions\s+WHERE subscriber_type = \$1 AND subscriber_id = \$2/);
		const ctx = () =>
			({
				meta: {},
				request: new Request('http://localhost/billing/webhook', {
					method: 'POST',
					headers: { 'stripe-signature': 't=1,v1=stub' },
					body: '{}',
				}),
			}) as never;
		const results = await Promise.all([
			webhookController(raced, config, undefined, bus).handle(ctx()),
			webhookController(raced, config, undefined, bus).handle(ctx()),
		]);
		await new Promise((r) => setTimeout(r, 20));
		assert.deepEqual(results.map((r) => r.status), [200, 200]);
		assert.equal((await row(store, WEBHOOK))?.status, 'canceled');
		assert.deepEqual(
			sent.filter((t) => t === MESSAGE_KEYS.subscriptionCanceled),
			[MESSAGE_KEYS.subscriptionCanceled],
			'one cancellation, one email',
		);
	} finally {
		await close(store);
	}
});

test('concurrent find-or-create makes ONE provider customer, keyed for provider idempotency', {
	skip,
}, async () => {
	const store = await connect();
	try {
		const keys: Array<string | undefined> = [];
		const provider = {
			name: 'fake',
			async createCustomer(opts: { idempotencyKey?: string }) {
				keys.push(opts.idempotencyKey);
				await new Promise((r) => setTimeout(r, 30));
				return { customerId: `cus_${keys.length}` };
			},
		};
		const opts = { email: 'buyer@acme.example', subscriberType: 'user' as const, subscriberId: CUSTOMER, userId: CUSTOMER };
		const out = await Promise.all(
			Array.from({ length: 5 }, () => findOrCreateRecordedCustomer(store, provider as never, opts)),
		);
		assert.equal(keys.length, 1, 'one customer created at the provider');
		assert.equal(keys[0], `fonderie-customer:user:${CUSTOMER}:0`);
		assert.deepEqual(new Set(out.map((o) => o.customerId)), new Set(['cus_1']));
		const [n] = await store.query<{ n: string }>(
			`SELECT count(*)::text AS n FROM fonderie_billing_customers WHERE subscriber_id = $1`,
			[CUSTOMER],
		);
		assert.equal(n?.n, '1');
	} finally {
		await close(store);
	}
});

test('a pay-as-you-go buyer (no subscription) reuses ONE provider customer across pack checkouts', {
	skip,
}, async () => {
	const store = await connect();
	try {
		let created = 0;
		const sessions: string[] = [];
		const provider = {
			name: 'fake',
			async createCustomer() {
				created++;
				return { customerId: `cus_payg_${created}` };
			},
			async createPaymentCheckoutSession(opts: { customerId: string }) {
				sessions.push(opts.customerId);
				return { url: 'https://checkout.acme.example/p', sessionId: `cs_${sessions.length}` };
			},
		};
		const ctrl = walletController(store, {
			provider,
			plans: [{ name: 'free' }],
			successUrl: 'https://acme.example/ok',
			cancelUrl: 'https://acme.example/cancel',
			wallet: {
				currency: 'USD',
				creditPacks: [{ id: 'small', name: 'Small', credits: 100n, priceAmount: 500n }],
			},
		} as never);
		for (let i = 0; i < 2; i++) {
			const res = await ctrl.checkout(userCtx(PAYG, { packId: 'small' }));
			assert.equal(res.status, 200);
		}
		assert.equal(created, 1, 'the second checkout found the first one\'s customer');
		assert.deepEqual(sessions, ['cus_payg_1', 'cus_payg_1']);
	} finally {
		await close(store);
	}
});

test('a usage-limit notice goes out ONCE across two API instances', { skip }, async () => {
	const store = await connect();
	try {
		const sent: string[] = [];
		const bus = {
			emit: async (event: string, payload: { type?: string }) => {
				if (event === NOTIFICATION_EVENT && payload.type) sent.push(payload.type);
			},
		} as unknown as EventBus;
		const config = {
			provider: {},
			plans: [{ name: 'free', policy: { 'calls-d': { limit: 1, buffer: 5, window: '1d' } } }],
			successUrl: 'https://acme.example/ok',
			cancelUrl: 'https://acme.example/cancel',
			notifications: { softHit: true },
			resolveRecipient: async () => ({ email: 'buyer@acme.example', phone: null, deviceToken: null }),
		} as unknown as IBillingConfig;
		// Two separately loaded copies of the middleware module = two processes,
		// each with its own in-memory state. The counter itself is shared, as a
		// db/redis counter backend would be.
		const counters = new MemoryCounterBackend();
		const instance = async (name: string) => {
			const path = `../middlewares/billing?instance=${name}`;
			const mod = (await import(path)) as typeof import('../middlewares/billing');
			return mod.withBilling(store, config, counters, bus);
		};
		const a = await instance('a');
		const b = await instance('b');
		const next = async () => new Response();
		await a(userCtx(NOTICE), next);
		await b(userCtx(NOTICE), next);
		await a(userCtx(NOTICE), next);
		await new Promise((r) => setTimeout(r, 20));
		assert.deepEqual(
			sent.filter((t) => t === MESSAGE_KEYS.limitReached),
			[MESSAGE_KEYS.limitReached],
			'one crossing, one email — not one per instance',
		);
	} finally {
		await close(store);
	}
});

test('account restored while its deletion is canceling at the provider: the subscription is resumed', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await webhookWrite(store, LIFECYCLE, 'active', 'sub_life');
		const calls: string[] = [];
		const provider = {
			name: 'fake',
			async cancelSubscription() {
				calls.push('cancel');
				// The restore event is handled while the cancel is in flight.
				await handleSubscriberRestored(store, { provider: provider as never }, { type: 'user', id: LIFECYCLE });
				return { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: null };
			},
			async reactivateSubscription() {
				calls.push('reactivate');
				return { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null };
			},
		};
		const out = await handleSubscriberDeleted(
			store,
			{ provider: provider as never },
			{ type: 'user', id: LIFECYCLE },
		);
		assert.equal(calls.at(-1), 'reactivate', `the kept account's subscription must end resumed; calls: ${calls.join(',')}`);
		assert.equal(out.canceled, 'none');
		const [r] = await store.query<{ marked: boolean }>(
			`SELECT ended_by_account_deletion AS marked FROM fonderie_subscriptions WHERE subscriber_id = $1`,
			[LIFECYCLE],
		);
		assert.equal(r?.marked, false, 'no stale deletion mark left on a kept account');
	} finally {
		await close(store);
	}
});

test('a trialing subscription whose trial record fails: nothing half-written, and the retry records both', {
	skip,
}, async () => {
	const store = await connect();
	try {
		const event = {
			type: 'customer.subscription.created',
			eventAt: new Date(),
			subscription: {
				subscriberType: 'user',
				subscriberId: TRIAL,
				plan: 'pro',
				priceLookupKey: null,
				priceId: null,
				status: 'trialing',
				providerCustomerId: 'cus_trial',
				providerSubscriptionId: 'sub_trial',
				currentPeriodStart: new Date(),
				currentPeriodEnd: new Date(Date.now() + 14 * 86_400_000),
				cancelAtPeriodEnd: false,
				trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
				interval: 'month',
			},
		};
		const config = {
			provider: { name: 'fake', constructEvent: async () => structuredClone(event) },
			webhookSecret: 'whsec_x',
			plans,
		} as never;
		const ctx = () =>
			({
				meta: {},
				request: new Request('http://localhost/billing/webhook', {
					method: 'POST',
					headers: { 'stripe-signature': 't=1,v1=stub' },
					body: '{}',
				}),
			}) as never;
		// The trial ledger write fails, the way a dropped connection would.
		const wrap = (s: IStoreAdapter): IStoreAdapter => ({
			async query<T>(sql: string, params?: unknown[]) {
				if (/INSERT INTO fonderie_subscription_trials/.test(sql)) throw new Error('connection lost');
				return s.query<T>(sql, params);
			},
			transaction: (fn) => s.transaction((tx) => fn(wrap(tx))),
		});
		const failed = await webhookController(wrap(store), config).handle(ctx()).catch(() => null);
		assert.notEqual(failed?.status, 200, 'the provider is told to retry');

		const trialRecorded = async () =>
			(
				await store.query(
					`SELECT 1 FROM fonderie_subscription_trials WHERE subscriber_type = 'user' AND subscriber_id = $1`,
					[TRIAL],
				)
			).length > 0;
		const sub = await row(store, TRIAL);
		assert.ok(
			!sub || (await trialRecorded()),
			`a ${sub?.status} subscription was written with no consumed trial on record`,
		);

		// The provider's retry, with the database back, lands both.
		const retry = await webhookController(store, config).handle(ctx());
		assert.equal(retry.status, 200);
		assert.equal((await row(store, TRIAL))?.status, 'trialing');
		assert.equal(await trialRecorded(), true);
	} finally {
		await close(store);
	}
});
