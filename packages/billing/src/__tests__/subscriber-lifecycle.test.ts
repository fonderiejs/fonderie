import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getMigrationsPath } from '../migrations';
import { BillingModule } from '../module';
import {
	USER_DELETED_EVENT,
	USER_PURGED_EVENT,
	handleSubscriberDeleted,
	handleSubscriberPurged,
} from '../services/subscriber-lifecycle';

// What happens to a user's money when the user goes away. Real PostgreSQL (the
// UPDATE/UNION run against the real schema), a recording fake provider.
//
//   BILLING_PG_URL=postgres://... npm test -w @fonderie/billing

const PG_URL = process.env['BILLING_PG_URL'];
const skip = PG_URL ? false : 'set BILLING_PG_URL to run';

const USER = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const WORKSPACE = '1c2d3e4f-5061-4b72-9c83-a4b5c6d7e8f9';

type Call = { op: string; arg: unknown };
function fakeProvider(opts: { failCancel?: Error; failDelete?: Error } = {}) {
	const calls: Call[] = [];
	return {
		calls,
		provider: {
			name: 'fake',
			cancelSubscription: async (arg: { subscriptionId: string; atPeriodEnd: boolean }) => {
				calls.push({ op: 'cancel', arg });
				if (opts.failCancel) throw opts.failCancel;
				return {
					status: arg.atPeriodEnd ? 'active' : 'canceled',
					cancelAtPeriodEnd: arg.atPeriodEnd,
					currentPeriodEnd: null,
				};
			},
			deleteCustomer: async (id: string) => {
				calls.push({ op: 'deleteCustomer', arg: id });
				if (opts.failDelete) throw opts.failDelete;
			},
		} as never,
	};
}

async function connect() {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	for (const id of [USER, WORKSPACE]) {
		await store.query(`DELETE FROM fonderie_subscriptions WHERE subscriber_id = $1`, [id]);
		await store.query(`DELETE FROM fonderie_wallet_customers WHERE subscriber_id = $1`, [id]);
	}
	return store;
}

async function seed(store: Awaited<ReturnType<typeof connect>>, status = 'active') {
	await store.query(
		`INSERT INTO fonderie_subscriptions (subscriber_type, subscriber_id, plan, interval, status, provider_customer_id, provider_subscription_id)
		 VALUES ('user', $1, 'pro', 'month', $2, 'cus_user_sub', 'sub_user_1'),
		        ('workspace', $3, 'team', 'month', 'active', 'cus_ws', 'sub_ws_1')`,
		[USER, status, WORKSPACE],
	);
	await store.query(
		`INSERT INTO fonderie_wallet_customers (subscriber_type, subscriber_id, provider, provider_customer_id, payment_method_id, pending_recharge_key)
		 VALUES ('user', $1, 'fake', 'cus_user_wallet', 'pm_card_1', 'recharge-key-1')`,
		[USER],
	);
}

const close = (store: unknown) => (store as { end?: () => Promise<void> }).end?.();

test('deleted: cancels the user subscription NOW and disarms off-session charging', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await seed(store);
		const { provider, calls } = fakeProvider();
		const out = await handleSubscriberDeleted(store, { provider }, { type: 'user', id: USER });
		assert.deepEqual(out, { canceled: 'now', chargingDisarmed: true });
		assert.deepEqual(calls, [
			{ op: 'cancel', arg: { subscriptionId: 'sub_user_1', atPeriodEnd: false } },
		]);
		const [w] = await store.query<{ d: boolean; pm: string | null; k: string | null }>(
			`SELECT auto_recharge_disabled AS d, payment_method_id AS pm, pending_recharge_key AS k FROM fonderie_wallet_customers WHERE subscriber_id = $1`,
			[USER],
		);
		assert.deepEqual(
			w,
			{ d: true, pm: null, k: null },
			'no stored card, no pending charge, auto-recharge off',
		);
		const [ws] = await store.query<{ status: string }>(
			`SELECT status FROM fonderie_subscriptions WHERE subscriber_id = $1`,
			[WORKSPACE],
		);
		assert.equal(ws?.status, 'active', 'a workspace subscription is untouched');
	} finally {
		await close(store);
	}
});

test('deleted: policy cancel-at-period-end, keep, and an already-canceled subscription', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await seed(store);
		const a = fakeProvider();
		await handleSubscriberDeleted(
			store,
			{ provider: a.provider, onSubscriberDeleted: 'cancel-at-period-end' },
			{ type: 'user', id: USER },
		);
		assert.deepEqual(a.calls[0]?.arg, { subscriptionId: 'sub_user_1', atPeriodEnd: true });

		const b = fakeProvider();
		const kept = await handleSubscriberDeleted(
			store,
			{ provider: b.provider, onSubscriberDeleted: 'keep' },
			{ type: 'user', id: USER },
		);
		assert.deepEqual(kept, { canceled: 'none', chargingDisarmed: false });
		assert.equal(b.calls.length, 0, "'keep' touches nothing");

		await store.query(
			`UPDATE fonderie_subscriptions SET status = 'canceled' WHERE subscriber_id = $1`,
			[USER],
		);
		const c = fakeProvider();
		const out = await handleSubscriberDeleted(
			store,
			{ provider: c.provider },
			{ type: 'user', id: USER },
		);
		assert.equal(out.canceled, 'none');
		assert.equal(c.calls.length, 0, 'a canceled subscription is not re-canceled at the provider');
	} finally {
		await close(store);
	}
});

test('deleted: a redelivery is harmless ("already canceled" at the provider is success); a real failure throws for retry', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await seed(store);
		const gone = fakeProvider({
			failCancel: Object.assign(new Error('No such subscription: sub_user_1'), {
				code: 'resource_missing',
			}),
		});
		const out = await handleSubscriberDeleted(
			store,
			{ provider: gone.provider },
			{ type: 'user', id: USER },
		);
		assert.equal(out.canceled, 'now');
		const down = fakeProvider({ failCancel: new Error('connection reset') });
		await assert.rejects(
			handleSubscriberDeleted(store, { provider: down.provider }, { type: 'user', id: USER }),
			/connection reset/,
		);
	} finally {
		await close(store);
	}
});

test('purged: deletes every provider customer the user had (subscription + wallet), once each; records stay', {
	skip,
}, async () => {
	const store = await connect();
	try {
		await seed(store);
		const { provider, calls } = fakeProvider();
		const out = await handleSubscriberPurged(store, { provider }, { type: 'user', id: USER });
		assert.equal(out.customersDeleted, 2);
		assert.deepEqual(calls.map((c) => c.arg).sort(), ['cus_user_sub', 'cus_user_wallet']);
		assert.ok(!calls.some((c) => c.arg === 'cus_ws'), 'the workspace customer is not touched');
		const [row] = await store.query<{ n: string }>(
			`SELECT count(*)::text AS n FROM fonderie_subscriptions WHERE subscriber_id = $1`,
			[USER],
		);
		assert.equal(row?.n, '1', 'the financial record is kept');
		const again = fakeProvider({
			failDelete: Object.assign(new Error('No such customer'), { code: 'resource_missing' }),
		});
		await handleSubscriberPurged(store, { provider: again.provider }, { type: 'user', id: USER });
	} finally {
		await close(store);
	}
});

test('BillingModule subscribes to both account events on the bus, and routes them to the user', async () => {
	const handlers = new Map<string, (p: unknown) => Promise<void>>();
	const bus = { on: (type: string, h: (p: unknown) => Promise<void>) => handlers.set(type, h) };
	const seen: string[] = [];
	const store = {
		query: async (sql: string, params: unknown[]) => {
			seen.push(`${sql.trim().split(/\s+/).slice(0, 2).join(' ')} ${JSON.stringify(params)}`);
			return [];
		},
		transaction: async () => undefined,
	};
	const { provider } = fakeProvider();
	new BillingModule(
		store as never,
		{ provider, plans: [], successUrl: 'x', cancelUrl: 'y' } as never,
		bus as never,
	);
	assert.deepEqual([...handlers.keys()].sort(), [USER_DELETED_EVENT, USER_PURGED_EVENT].sort());
	await handlers.get(USER_DELETED_EVENT)!({ userId: USER });
	assert.ok(
		seen.some((q) => q.includes(`"user","${USER}"`)),
		'the handler looked up this user as a user subscriber',
	);
});
