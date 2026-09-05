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
	sumReversedCreditsByProviderTxId,
} from '../services/wallet';
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
