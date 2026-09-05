import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getMigrationsPath } from '../migrations';
import { creditWallet, debitWallet, ensurePeriodicGrant, getWalletBalance } from '../services/wallet';
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
