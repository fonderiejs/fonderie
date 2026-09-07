import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getMigrationsPath } from '../migrations';
import {
	creditWallet,
	debitWallet,
	ensurePeriodicGrant,
	findPurchaseByProviderTxId,
	getWalletBalance,
	reverseWallet,
	setSpendPurchased,
	settleAllowance,
	startOfNextPeriod,
	sumReversedCreditsByProviderTxId,
} from '../services/wallet';
import {
	claimAutoRecharge,
	recordRechargeFailure,
	upsertWalletCustomer,
} from '../services/wallet-customers';
import { InsufficientFundsError } from '../errors';
import type { SubscriberType } from '../types';

// Real-engine atomicity proof for the wallet. The unit tests exercise an
// in-process emulator of the row lock and UNIQUE constraint; this drives an
// actual PostgreSQL, because "atomic, no double-spend" is a claim about the
// ENGINE, not about our emulator. Same two-leg pattern as @fonderie/rate-limit.
//
// Gated on an env var so `npm test` stays green with no database. CI sets it
// against the postgres:16 service container (see .github/workflows/ci.yml).
// Run locally with:
//   BILLING_PG_URL=postgres://... npm test -w @fonderie/billing

const PG_URL = process.env['BILLING_PG_URL'];

const SUB = {
	subscriberType: 'user' as SubscriberType,
	subscriberId: '7d9e6d3a-52a4-4b8e-9a75-1c2b3d4e5f60',
	currency: 'USD',
};

async function connect() {
	const { PGAdapter, InternalMigrationRunner } = await import('@fonderie/store');
	const store = new PGAdapter(PG_URL!);
	await new InternalMigrationRunner(store, getMigrationsPath()).run();
	await store.query(`DELETE FROM fonderie_wallet_ledger WHERE subscriber_id = $1`, [SUB.subscriberId]);
	await store.query(`DELETE FROM fonderie_wallet_balances WHERE subscriber_id = $1`, [SUB.subscriberId]);
	await store.query(`DELETE FROM fonderie_wallet_grants WHERE subscriber_id = $1`, [SUB.subscriberId]);
	await store.query(`DELETE FROM fonderie_wallet_customers WHERE subscriber_id = $1`, [SUB.subscriberId]);
	return store;
}

test(
	'PostgreSQL: concurrent debits grant exactly the balance, never more',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await creditWallet({ ...SUB, amount: 1000n, type: 'grant', idempotencyKey: 'itest-fund' }, store);

			const attempts = 20;
			const results = await Promise.allSettled(
				Array.from({ length: attempts }, (_, i) =>
					debitWallet({ ...SUB, amount: 100n, idempotencyKey: `itest-debit-${i}` }, store),
				),
			);
			const ok = results.filter((r) => r.status === 'fulfilled').length;
			const rejected = results.filter((r) => r.status === 'rejected');
			assert.equal(ok, 10, `exactly 10 of ${attempts} debits must fit in the balance; got ${ok}`);
			for (const r of rejected) {
				assert.ok(
					(r as PromiseRejectedResult).reason instanceof InsufficientFundsError,
					'losers must fail with InsufficientFundsError',
				);
			}

			const { balance } = await getWalletBalance(SUB, store);
			assert.equal(balance, 0n);

			// Ledger consistency: the signed amounts must sum to the balance.
			const [sum] = await store.query<{ total: string }>(
				`SELECT COALESCE(SUM(amount), 0) AS total FROM fonderie_wallet_ledger
				WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
				[SUB.subscriberType, SUB.subscriberId, SUB.currency],
			);
			assert.equal(BigInt(sum?.total ?? '-1'), 0n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: concurrent SAME-KEY debits deduct exactly once (conflict rollback)',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		// The one case where idempotency depends on ROLLING BACK an applied
		// deduction: concurrent same-key debits can all miss the pre-check
		// under READ COMMITTED, apply the balance UPDATE serially, and only
		// the UNIQUE-violation rollback undoes the extra deductions.
		const store = await connect();
		try {
			await creditWallet({ ...SUB, amount: 1000n, type: 'grant', idempotencyKey: 'itest-fund-samekey' }, store);
			const results = await Promise.allSettled(
				Array.from({ length: 10 }, () =>
					debitWallet({ ...SUB, amount: 300n, idempotencyKey: 'itest-debit-same' }, store),
				),
			);
			for (const r of results) {
				assert.equal(r.status, 'fulfilled', 'same-key replays must all resolve');
				assert.equal((r as PromiseFulfilledResult<{ balance: bigint }>).value.balance, 700n);
			}
			const { balance } = await getWalletBalance(SUB, store);
			assert.equal(balance, 700n, 'the wallet must be debited exactly once');
			const rows = await store.query<{ id: string }>(
				`SELECT id FROM fonderie_wallet_ledger WHERE idempotency_key = $1`,
				['itest-debit-same'],
			);
			assert.equal(rows.length, 1);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: concurrent identical credits apply exactly once (UNIQUE idempotency key)',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			const results = await Promise.all(
				Array.from({ length: 10 }, () =>
					creditWallet({ ...SUB, amount: 250n, type: 'purchase', idempotencyKey: 'itest-same-key' }, store),
				),
			);
			for (const r of results) assert.equal(r.balance, 250n);
			assert.equal(results.filter((r) => !r.duplicate).length, 1);

			const rows = await store.query<{ id: string }>(
				`SELECT id FROM fonderie_wallet_ledger WHERE idempotency_key = $1`,
				['itest-same-key'],
			);
			assert.equal(rows.length, 1);
			const { balance } = await getWalletBalance(SUB, store);
			assert.equal(balance, 250n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: buy → spend → refund claws back credits into a NEGATIVE balance, idempotently',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		// The §C value-leak fix on the real engine: proves reverseWallet drives
		// the balance below zero (bypassing the debit floor), that the refund→
		// purchase join by provider_tx_id resolves, that the cumulative-reversal
		// sum is honest, and that the ledger's CHECK constraints (amount<>0, type
		// IN(...)) accept a negative 'refund' row — none of which the emulator proves.
		const store = await connect();
		try {
			const pi = 'pi_itest_refund';
			await creditWallet(
				{ ...SUB, amount: 5000n, type: 'purchase', idempotencyKey: 'itest-buy', providerTxId: pi },
				store,
			);
			await debitWallet({ ...SUB, amount: 3000n, type: 'usage', idempotencyKey: 'itest-spend' }, store);
			assert.equal((await getWalletBalance(SUB, store)).balance, 2000n);

			const purchase = await findPurchaseByProviderTxId(pi, store);
			assert.equal(purchase?.credits, 5000n);
			assert.equal(purchase?.subscriberId, SUB.subscriberId);

			const r1 = await reverseWallet(
				{ ...SUB, amount: 5000n, idempotencyKey: 'itest-refund-1', providerTxId: pi, description: 'refund' },
				store,
			);
			assert.equal(r1.duplicate, false);
			assert.equal(r1.balance, -3000n, 'a refunded buyer who spent credits ends up owing them');
			assert.equal(await sumReversedCreditsByProviderTxId(pi, store), 5000n);

			// Replay the same refund → idempotent no-op, balance unchanged.
			const r2 = await reverseWallet(
				{ ...SUB, amount: 5000n, idempotencyKey: 'itest-refund-1', providerTxId: pi },
				store,
			);
			assert.equal(r2.duplicate, true);
			assert.equal((await getWalletBalance(SUB, store)).balance, -3000n);

			// Ledger consistency: signed amounts (purchase +5000, usage -3000,
			// refund -5000) sum to the balance.
			const [sum] = await store.query<{ total: string }>(
				`SELECT COALESCE(SUM(amount), 0) AS total FROM fonderie_wallet_ledger
				WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
				[SUB.subscriberType, SUB.subscriberId, SUB.currency],
			);
			assert.equal(BigInt(sum?.total ?? '0'), -3000n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: concurrent reversals for one charge never over-reverse past the granted credits',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		// The per-charge cap must hold even when a chargeback (full amount) and a
		// partial refund for the SAME PaymentIntent are processed concurrently.
		// Without the in-transaction advisory lock + re-summed cap, both read a
		// stale "nothing reversed yet" and together reverse 5000 + 2000 = 7000
		// for a 5000-credit purchase.
		const store = await connect();
		try {
			const pi = 'pi_itest_concurrent';
			await creditWallet(
				{ ...SUB, amount: 5000n, type: 'purchase', idempotencyKey: 'itest-cc-buy', providerTxId: pi },
				store,
			);
			const [dispute, refund] = await Promise.all([
				reverseWallet(
					{ ...SUB, amount: 5000n, capToProviderTxId: 5000n, idempotencyKey: 'itest-cc-dispute', providerTxId: pi },
					store,
				),
				reverseWallet(
					{ ...SUB, amount: 2000n, capToProviderTxId: 5000n, idempotencyKey: 'itest-cc-refund', providerTxId: pi },
					store,
				),
			]);
			const totalReversed = dispute.reversed + refund.reversed;
			assert.equal(totalReversed, 5000n, `cumulative reversed must be capped at 5000; got ${totalReversed}`);
			assert.equal((await getWalletBalance(SUB, store)).balance, 0n, 'never below what was granted');
			assert.equal(await sumReversedCreditsByProviderTxId(pi, store), 5000n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: concurrent auto-recharge claims yield exactly one (per-charge dedup)',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		// The claim is what guarantees a burst of low-balance requests fires ONE
		// charge, not N. On real Postgres the single conditional UPDATE row-locks:
		// the winner sets last_recharge_at, and every loser re-evaluates the
		// cooldown predicate against the new row and matches nothing.
		const store = await connect();
		try {
			const key = { subscriberType: SUB.subscriberType, subscriberId: SUB.subscriberId, provider: 'stripe' };
			await upsertWalletCustomer(
				{ ...key, providerCustomerId: 'cus_itest', rearm: true, paymentMethodId: 'pm_itest' },
				store,
			);

			const claims = await Promise.all(
				Array.from({ length: 12 }, () => claimAutoRecharge({ ...key, cooldownSeconds: 3600 }, store)),
			);
			const won = claims.filter((c) => c !== null);
			assert.equal(won.length, 1, `exactly one claim must win; got ${won.length}`);
			assert.equal(won[0]!.providerCustomerId, 'cus_itest');
			assert.equal(won[0]!.paymentMethodId, 'pm_itest', 'consented card round-trips (migration 009 column)');

			// A later claim within the cooldown is still blocked.
			assert.equal(await claimAutoRecharge({ ...key, cooldownSeconds: 3600 }, store), null);

			// Failures disable after the limit, and a disabled row never claims.
			await recordRechargeFailure({ ...key, maxConsecutiveFailures: 1 }, store);
			assert.equal(await claimAutoRecharge({ ...key, cooldownSeconds: 0 }, store), null);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: concurrent periodic grants for one period apply exactly once',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			const results = await Promise.all(
				Array.from({ length: 10 }, () =>
					ensurePeriodicGrant({ ...SUB, amount: 500n, period: '2026-09' }, store),
				),
			);
			assert.equal(results.filter((r) => r.granted).length, 1);
			const { balance } = await getWalletBalance(SUB, store);
			assert.equal(balance, 500n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

// ── Phase 5a: allowance (granted) vs purchased buckets ────────────────────────

const OCT = startOfNextPeriod('month', new Date(Date.UTC(2026, 8, 15))); // 2026-10-01
const NOV = startOfNextPeriod('month', new Date(Date.UTC(2026, 9, 15))); // 2026-11-01

test(
	'PostgreSQL: allowance-first debit — free credits spend before purchased',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await ensurePeriodicGrant({ ...SUB, amount: 50n, period: '2026-09', expiresAt: OCT }, store);
			await creditWallet({ ...SUB, amount: 100n, type: 'purchase', idempotencyKey: 'p5-buy' }, store);
			let bal = await getWalletBalance(SUB, store);
			assert.equal(bal.balance, 150n);
			assert.equal(bal.granted, 50n);
			assert.equal(bal.purchased, 100n);

			await debitWallet({ ...SUB, amount: 30n, idempotencyKey: 'p5-d1' }, store);
			bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 20n, 'debit drew from the allowance first');
			assert.equal(bal.purchased, 100n, 'purchased untouched while allowance remains');

			await debitWallet({ ...SUB, amount: 40n, idempotencyKey: 'p5-d2' }, store);
			bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 0n, 'allowance exhausted');
			assert.equal(bal.purchased, 80n, 'the overflow spilled onto purchased');

			const [row] = await store.query<{ metadata: Record<string, string> }>(
				`SELECT metadata FROM fonderie_wallet_ledger WHERE idempotency_key = 'p5-d2'`,
			);
			assert.equal(row?.metadata?.['fromGranted'], '20');
			assert.equal(row?.metadata?.['fromPurchased'], '20');
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: expiry (none) burns the unspent allowance and leaves purchased intact',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await ensurePeriodicGrant({ ...SUB, amount: 50n, period: '2026-09', expiresAt: OCT }, store);
			await creditWallet({ ...SUB, amount: 100n, type: 'purchase', idempotencyKey: 'p5-buy' }, store);
			await debitWallet({ ...SUB, amount: 12n, idempotencyKey: 'p5-d1' }, store); // granted 38

			const res = await settleAllowance({ ...SUB, period: '2026-10', rollover: 'none', expiresAt: NOV }, store);
			assert.equal(res.settled, true);
			const bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 0n, 'use-it-or-lose-it: allowance expired');
			assert.equal(bal.purchased, 100n, 'purchased survives the period boundary');
			assert.equal(bal.balance, 100n);

			const [exp] = await store.query<{ amount: string }>(
				`SELECT amount FROM fonderie_wallet_ledger WHERE subscriber_id = $1 AND type = 'expiry'`,
				[SUB.subscriberId],
			);
			assert.equal(exp?.amount, '-38');
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: expiry (full and cap) rollover policies',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			// full: entire remainder carries forward, no expiry row.
			await ensurePeriodicGrant({ ...SUB, amount: 50n, period: '2026-09', expiresAt: OCT }, store);
			await debitWallet({ ...SUB, amount: 12n, idempotencyKey: 'p5-d1' }, store); // granted 38
			await settleAllowance({ ...SUB, period: '2026-10', rollover: 'full', expiresAt: NOV }, store);
			let bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 38n, 'full rollover keeps the whole remainder');
			assert.equal(bal.balance, 38n);

			// cap: carry up to the cap, expire the rest.
			await settleAllowance({ ...SUB, period: '2026-11', rollover: { cap: 20n }, expiresAt: NOV }, store);
			bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 20n, 'cap rollover keeps min(remainder, cap)');
			assert.equal(bal.balance, 20n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: spend_purchased=false hard-stops at the allowance even with purchased credits',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await ensurePeriodicGrant({ ...SUB, amount: 50n, period: '2026-09', expiresAt: OCT }, store);
			await creditWallet({ ...SUB, amount: 100n, type: 'purchase', idempotencyKey: 'p5-buy' }, store);
			await store.query(
				`UPDATE fonderie_wallet_balances SET spend_purchased = false WHERE subscriber_id = $1`,
				[SUB.subscriberId],
			);

			await assert.rejects(
				() => debitWallet({ ...SUB, amount: 60n, idempotencyKey: 'p5-blocked' }, store),
				InsufficientFundsError,
				'a 60 debit is refused: only the 50 allowance is spendable, not the 100 purchased',
			);

			await debitWallet({ ...SUB, amount: 40n, idempotencyKey: 'p5-ok' }, store);
			let bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 10n);
			assert.equal(bal.purchased, 100n, 'purchased never touched while the toggle is off');

			// Re-enable and the overflow reaches purchased.
			await store.query(
				`UPDATE fonderie_wallet_balances SET spend_purchased = true WHERE subscriber_id = $1`,
				[SUB.subscriberId],
			);
			await debitWallet({ ...SUB, amount: 40n, idempotencyKey: 'p5-on' }, store);
			bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 0n);
			assert.equal(bal.purchased, 70n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: a refund claws back purchased ONLY — the allowance is untouched',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await ensurePeriodicGrant({ ...SUB, amount: 50n, period: '2026-09', expiresAt: OCT }, store);
			await creditWallet(
				{ ...SUB, amount: 100n, type: 'purchase', idempotencyKey: 'p5-buy', providerTxId: 'pi_x' },
				store,
			);
			await reverseWallet(
				{ ...SUB, amount: 100n, capToProviderTxId: 100n, providerTxId: 'pi_x', idempotencyKey: 'p5-refund' },
				store,
			);
			const bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 50n, 'the granted allowance is structurally untouched by a refund');
			assert.equal(bal.purchased, 0n, 'the refund consumed only the purchased credits');
			assert.equal(bal.balance, 50n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: overdraft eats purchased, never drives the allowance negative',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await ensurePeriodicGrant({ ...SUB, amount: 30n, period: '2026-09', expiresAt: OCT }, store);
			await debitWallet({ ...SUB, amount: 60n, overdraftLimit: 50n, idempotencyKey: 'p5-od' }, store);
			const bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 0n, 'granted floored at 0, never negative');
			assert.equal(bal.balance, -30n, 'overdraft drove the total (purchased) negative');
			assert.equal(bal.purchased, -30n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: a legacy single-balance row is all purchased and never expires',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			// Simulate a pre-Phase-5 balance: amount only, granted columns at defaults.
			await store.query(
				`INSERT INTO fonderie_wallet_balances (subscriber_type, subscriber_id, currency, amount)
				VALUES ($1, $2, $3, 500)`,
				[SUB.subscriberType, SUB.subscriberId, SUB.currency],
			);
			const res = await settleAllowance({ ...SUB, period: '2026-10', rollover: 'none', expiresAt: NOV }, store);
			assert.equal(res.settled, false, 'never-granted balance has nothing to expire');
			const bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 0n);
			assert.equal(bal.purchased, 500n, 'legacy balance classifies wholly as purchased');
			assert.equal(bal.balance, 500n);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: setSpendPurchased upserts a preference for a subscriber with no balance row',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			// No credit ever → no balance row. The setter must UPSERT, not no-op.
			await setSpendPurchased({ ...SUB, spendPurchased: false }, store);
			const bal = await getWalletBalance(SUB, store);
			assert.equal(bal.spendPurchased, false, 'preference persisted on a freshly-created row');
			assert.equal(bal.balance, 0n, 'the created row starts at zero');
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

test(
	'PostgreSQL: setSpendPurchased toggles the debit hard-stop end to end',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		const store = await connect();
		try {
			await ensurePeriodicGrant({ ...SUB, amount: 50n, period: '2026-09', expiresAt: OCT }, store);
			await creditWallet({ ...SUB, amount: 100n, type: 'purchase', idempotencyKey: 'p5b-buy' }, store);

			// OFF via the service → a debit past the allowance is refused.
			await setSpendPurchased({ ...SUB, spendPurchased: false }, store);
			await assert.rejects(
				() => debitWallet({ ...SUB, amount: 60n, idempotencyKey: 'p5b-blocked' }, store),
				InsufficientFundsError,
			);

			// ON via the service → the overflow reaches purchased.
			await setSpendPurchased({ ...SUB, spendPurchased: true }, store);
			await debitWallet({ ...SUB, amount: 60n, idempotencyKey: 'p5b-ok' }, store);
			const bal = await getWalletBalance(SUB, store);
			assert.equal(bal.granted, 0n);
			assert.equal(bal.purchased, 90n, '10 of the 60 came from purchased after the allowance');
			assert.equal(bal.spendPurchased, true);
		} finally {
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);

// ── subscription webhook ordering guard (provider_event_at) ───────────────────

test(
	'PostgreSQL: a stale/out-of-order subscription event never resurrects a canceled row',
	{ skip: PG_URL ? false : 'set BILLING_PG_URL to run' },
	async () => {
		// Providers deliver customer.subscription.* at-least-once with NO ordering
		// guarantee, so a retried "updated" arriving after "deleted" would overwrite
		// the canceled row back to active/paid — a customer keeps paid access after
		// cancelling. The provider_event_at guard makes the stale upsert a no-op and
		// reports not-applied. This is an ENGINE claim (the WHERE lives in SQL).
		const { upsertSubscription, getSubscription } = await import('../services/subscriptions');
		const store = await connect();
		const clear = () =>
			store.query(`DELETE FROM fonderie_subscriptions WHERE subscriber_id = $1`, [SUB.subscriberId]);
		try {
			await clear();
			const base = {
				subscriberType: SUB.subscriberType,
				subscriberId: SUB.subscriberId,
				providerCustomerId: 'cus_sub_order',
				providerSubscriptionId: 'sub_order',
			};
			const t1 = new Date('2026-09-01T00:00:00Z');
			const t2 = new Date('2026-09-01T00:05:00Z');
			const t3 = new Date('2026-09-01T00:10:00Z');
			const get = () => getSubscription(SUB.subscriberType, SUB.subscriberId, store);

			// T1: active on pro. The write applies (fresh row).
			assert.equal(
				await upsertSubscription({ ...base, plan: 'pro', status: 'active', providerEventAt: t1 }, store),
				true,
			);
			assert.equal((await get())?.status, 'active');

			// T2 (> T1): the cancellation lands (deleted → free/canceled).
			assert.equal(
				await upsertSubscription({ ...base, plan: 'free', status: 'canceled', providerEventAt: t2 }, store),
				true,
			);
			let row = await get();
			assert.equal(row?.status, 'canceled');
			assert.equal(row?.plan, 'free');

			// STALE retry of the T1 "updated" arriving late — MUST be a no-op, and the
			// upsert must REPORT not-applied so the controller skips its side effects.
			assert.equal(
				await upsertSubscription({ ...base, plan: 'pro', status: 'active', providerEventAt: t1 }, store),
				false,
				'a stale event reports not-applied',
			);
			row = await get();
			assert.equal(row?.status, 'canceled', 'a stale event must NOT resurrect the subscription');
			assert.equal(row?.plan, 'free');

			// A genuinely newer event (re-subscribe at T3) still applies.
			assert.equal(
				await upsertSubscription(
					{ ...base, plan: 'pro', status: 'active', providerSubscriptionId: 'sub_order_2', providerEventAt: t3 },
					store,
				),
				true,
			);
			row = await get();
			assert.equal(row?.status, 'active', 'a newer event still applies');
			assert.equal(row?.plan, 'pro');

			// A non-webhook write (no providerEventAt) applies unconditionally and
			// PRESERVES the stored ordering token (COALESCE, not assign).
			assert.equal(
				await upsertSubscription(
					{ ...base, plan: 'pro', status: 'active', cancelAtPeriodEnd: true, providerSubscriptionId: 'sub_order_2' },
					store,
				),
				true,
			);
			row = await get();
			assert.equal(row?.cancelAtPeriodEnd, true, 'an app-initiated write always applies');

			// Because the T3 token survived that null write, a T1 stale retry is still rejected.
			assert.equal(
				await upsertSubscription({ ...base, plan: 'starter', status: 'active', providerEventAt: t1 }, store),
				false,
				'ordering token preserved across the non-webhook write',
			);
			row = await get();
			assert.equal(row?.plan, 'pro', 'ordering token preserved across the non-webhook write');
		} finally {
			await clear();
			await (store as unknown as { end(): Promise<void> }).end();
		}
	},
);
