import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { getMigrationsPath } from '../migrations';
import { maybeAutoRecharge } from '../services/auto-recharge';
import { resolvePlanWallet } from '../services/wallet';
import { upsertWalletCustomer } from '../services/wallet-customers';

// Auto-recharge's bookkeeping on the subscriber's wallet-customer row, on a
// REAL PostgreSQL, when the connection drops between two writes. Each fact
// that must hold together (the claimed window and the key it charges with; a
// resolved charge and its released key; a decline and its count) has to land
// in ONE statement — otherwise a failure leaves the row half-updated:
//   - success recorded, key left pending → every later window re-sends a
//     captured charge, credits nothing, and after 23h disables auto-recharge;
//   - key released, decline not counted → a dead card is retried forever.
//
//   BILLING_PG_URL=postgres://... npm test -w @fonderie/billing

const PG_URL = process.env['BILLING_PG_URL'];
const skip = PG_URL ? false : 'set BILLING_PG_URL to run';

// This file's own subscriber: CI runs every suite against one database.
const SUBSCRIBER = 'a7c1e000-0000-4000-8000-0000000000b8';
const KEY = { subscriberType: 'user' as const, subscriberId: SUBSCRIBER, provider: 'stub' };
const PACK = { id: 'refill', name: 'Refill', credits: 1000n, priceAmount: 500n };

async function connect() {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	for (const table of [
		'fonderie_wallet_ledger',
		'fonderie_wallet_balances',
		'fonderie_wallet_customers',
	]) {
		await store.query(`DELETE FROM ${table} WHERE subscriber_id = $1`, [SUBSCRIBER]);
	}
	await upsertWalletCustomer({ ...KEY, providerCustomerId: 'cus_b8', rearm: true }, store);
	return store;
}

const close = (store: unknown) => (store as { end?: () => Promise<void> }).end?.();

function config(status: 'succeeded' | 'declined', onCharge: () => void): IBillingConfig {
	return {
		provider: {
			name: 'stub',
			async chargeOffSession() {
				onCharge();
				return { providerTxId: status === 'succeeded' ? 'pi_b8_1' : null, status };
			},
		},
		plans: [
			{ name: 'metered', wallet: { autoRecharge: { threshold: 100n, packId: PACK.id } } },
		],
		successUrl: 'https://acme.example/ok',
		cancelUrl: 'https://acme.example/cancel',
		wallet: { currency: 'USD', precision: 2, creditPacks: [PACK] },
	} as unknown as IBillingConfig;
}

// Fails the Nth write to the wallet-customer row.
function dropsWrite(inner: IStoreAdapter, n: number) {
	let writes = 0;
	const wrap = (s: IStoreAdapter): IStoreAdapter => ({
		async query<T>(sql: string, params?: unknown[]) {
			if (/UPDATE fonderie_wallet_customers/.test(sql) && ++writes === n)
				throw new Error('connection lost');
			return s.query<T>(sql, params);
		},
		transaction: (fn) => s.transaction((tx) => fn(wrap(tx))),
	});
	return wrap(inner);
}

async function run(store: IStoreAdapter, cfg: IBillingConfig) {
	await maybeAutoRecharge({
		store,
		config: cfg,
		bus: undefined,
		subscriberType: 'user',
		subscriberId: SUBSCRIBER,
		balance: 50n,
		planWallet: resolvePlanWallet(cfg.plans[0] as never, cfg)!,
	}).catch(() => undefined);
}

async function row(store: IStoreAdapter) {
	const [r] = await store.query<{
		claimed: boolean;
		pendingKey: string | null;
		failures: number;
	}>(
		`SELECT last_recharge_at IS NOT NULL AS claimed, pending_recharge_key AS "pendingKey",
		        consecutive_failures AS failures
		 FROM fonderie_wallet_customers
		 WHERE subscriber_type = 'user' AND subscriber_id = $1 AND provider = 'stub'`,
		[SUBSCRIBER],
	);
	return r!;
}

test('a successful recharge whose next write fails: no key left pending behind a captured charge', {
	skip,
}, async () => {
	const store = await connect();
	try {
		let charged = false;
		const cfg = config('succeeded', () => (charged = true));
		// Run as separate writes this was claim, set key, [charge], record
		// success, release key — the fourth write is the one the connection
		// drops. Whatever the code does, what survives must be consistent.
		await run(dropsWrite(store, 4), cfg);
		assert.ok(charged, 'the charge happened');
		const r = await row(store);
		assert.equal(r.pendingKey, null, `a resolved charge still has its key pending: ${r.pendingKey}`);
	} finally {
		await close(store);
	}
});

test('a declined recharge whose next write fails: the key is never released without the decline counted', {
	skip,
}, async () => {
	const store = await connect();
	try {
		const cfg = config('declined', () => undefined);
		// claim, set key, [charge], release key, count decline: drop the 4th.
		await run(dropsWrite(store, 4), cfg);
		const r = await row(store);
		assert.ok(
			r.pendingKey !== null || r.failures === 1,
			`key released with ${r.failures} decline(s) counted`,
		);
	} finally {
		await close(store);
	}
});

test('a claim whose next write fails: the claimed window always has its charge key recorded', {
	skip,
}, async () => {
	const store = await connect();
	try {
		let charged = false;
		// The write right after the claim is dropped.
		await run(dropsWrite(store, 2), config('succeeded', () => (charged = true)));
		const r = await row(store);
		assert.ok(
			!r.claimed || r.pendingKey !== null || charged,
			'the window was consumed with no charge key recorded and no charge made',
		);
	} finally {
		await close(store);
	}
});

test('the healthy path: one charge, credited, key released, failures reset', { skip }, async () => {
	const store = await connect();
	try {
		await run(store, config('succeeded', () => undefined));
		const r = await row(store);
		assert.deepEqual(r, { claimed: true, pendingKey: null, failures: 0 });
		const [bal] = await store.query<{ amount: string }>(
			`SELECT amount::text FROM fonderie_wallet_balances WHERE subscriber_id = $1`,
			[SUBSCRIBER],
		);
		assert.equal(bal?.amount, '1000');
	} finally {
		await close(store);
	}
});
