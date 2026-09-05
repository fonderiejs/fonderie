import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { IStoreAdapter } from '@fonderie/store';

import type { IWalletLedgerEntry, SubscriberType, WalletLedgerType } from '../types';
import type { IBillingConfig } from '../config';

// ── Wallet store emulator ─────────────────────────────────────────
//
// The smoke tests' SQL-fragment stubs can't prove atomicity, so — like
// rate-limit's pgEmulator — this emulates the Postgres semantics the wallet
// relies on: transactions serialize (one chain = the FOR UPDATE row lock),
// roll back on throw (state snapshot), and the ledger's UNIQUE
// idempotency_key raises code 23505. integration.test.ts proves the same
// claims against a real engine.

interface IBalRow {
	amount: bigint;
	version: number;
	updatedAt: string;
}

interface ILedgerRow {
	id: string;
	subscriberType: string;
	subscriberId: string;
	currency: string;
	type: WalletLedgerType;
	amount: bigint;
	balanceAfter: bigint;
	description: string | null;
	idempotencyKey: string;
	metadata: Record<string, unknown>;
	providerTxId: string | null;
	createdAt: string;
}

interface ICustomerRow {
	providerCustomerId: string;
	disabled: boolean;
	failures: number;
	lastRechargeAt: number | null; // epoch ms
	pendingKey: string | null;
}

interface IWalletState {
	balances: Map<string, IBalRow>;
	ledger: ILedgerRow[];
	grants: Map<string, bigint>;
	customers: Map<string, ICustomerRow>;
	seq: number;
}

function uniqueViolation(): Error {
	return Object.assign(
		new Error('duplicate key value violates unique constraint "fonderie_wallet_ledger_idempotency_key_key"'),
		{ code: '23505', constraint: 'fonderie_wallet_ledger_idempotency_key_key' },
	);
}

function runWalletSql(state: IWalletState, sql: string, params: unknown[] = []): unknown[] {
	const balKey = (st: unknown, sid: unknown, cur: unknown) => `${st}|${sid}|${cur}`;

	// Advisory lock — the serializing emulator already serializes transactions,
	// so this is a no-op here; real per-charge serialization is proven on PG.
	if (sql.includes('pg_advisory_xact_lock')) return [];

	if (sql.includes('fonderie_wallet_ledger')) {
		// Net reversed credits for a provider tx = SUM of its 'refund' amounts
		// (negative). Checked before the provider_tx_id branch (its SQL also
		// carries provider_tx_id = $1).
		if (sql.includes('SUM(amount)')) {
			const total = state.ledger
				.filter((l) => l.providerTxId === params[0] && l.type === 'refund')
				.reduce((acc, l) => acc + l.amount, 0n);
			return [{ total: total.toString() }];
		}
		// Original purchase lookup by provider tx id (the refund→purchase join).
		if (sql.includes('provider_tx_id = $1')) {
			const row = state.ledger.find((l) => l.providerTxId === params[0] && l.type === 'purchase');
			return row
				? [
						{
							subscriberType: row.subscriberType,
							subscriberId: row.subscriberId,
							currency: row.currency,
							amount: row.amount.toString(),
							metadata: row.metadata,
						},
					]
				: [];
		}
		if (sql.includes('idempotency_key = $1')) {
			const row = state.ledger.find((l) => l.idempotencyKey === params[0]);
			// findLedgerAmountByKey selects only `amount`; findByIdempotencyKey
			// selects the subscriber columns.
			if (sql.includes('SELECT amount FROM fonderie_wallet_ledger')) {
				return row ? [{ amount: row.amount.toString() }] : [];
			}
			return row
				? [{ subscriberType: row.subscriberType, subscriberId: row.subscriberId, currency: row.currency }]
				: [];
		}
		if (sql.trimStart().startsWith('INSERT')) {
			const [st, sid, cur, type, amount, balanceAfter, description, idempotencyKey, metadata, providerTxId] =
				params as [string, string, string, WalletLedgerType, string, string, string | null, string, string, string | null];
			if (state.ledger.some((l) => l.idempotencyKey === idempotencyKey)) throw uniqueViolation();
			state.seq++;
			state.ledger.push({
				id: `00000000-0000-4000-8000-${String(state.seq).padStart(12, '0')}`,
				subscriberType: st,
				subscriberId: sid,
				currency: cur,
				type,
				amount: BigInt(amount),
				balanceAfter: BigInt(balanceAfter),
				description,
				idempotencyKey,
				metadata: JSON.parse(metadata),
				providerTxId,
				createdAt: new Date(1_700_000_000_000 + state.seq * 1000).toISOString(),
			});
			return [];
		}
		// Paginated history read.
		const [st, sid, cur, ...rest] = params as [string, string, string, ...unknown[]];
		const hasCursor = sql.includes('AND (created_at, id) <');
		const cursor = hasCursor ? { createdAt: rest[0] as string, id: rest[1] as string } : null;
		const limit = Number(rest[hasCursor ? 2 : 0]);
		const rows = state.ledger
			.filter((l) => l.subscriberType === st && l.subscriberId === sid && l.currency === cur)
			.filter(
				(l) =>
					!cursor ||
					l.createdAt < cursor.createdAt ||
					(l.createdAt === cursor.createdAt && l.id < cursor.id),
			)
			.sort((a, b) =>
				a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1,
			)
			.slice(0, limit);
		return rows.map((l) => ({
			id: l.id,
			subscriberType: l.subscriberType,
			subscriberId: l.subscriberId,
			currency: l.currency,
			type: l.type,
			amount: l.amount.toString(),
			balanceAfter: l.balanceAfter.toString(),
			description: l.description,
			idempotencyKey: l.idempotencyKey,
			metadata: l.metadata,
			providerTxId: l.providerTxId,
			createdAt: l.createdAt,
			createdAtRaw: l.createdAt,
		}));
	}

	if (sql.includes('fonderie_wallet_balances')) {
		if (sql.trimStart().startsWith('INSERT') && sql.includes('DO UPDATE')) {
			const [st, sid, cur, amount] = params as [string, string, string, string];
			const key = balKey(st, sid, cur);
			const row = state.balances.get(key);
			if (row) {
				row.amount += BigInt(amount);
				row.version += 1;
				row.updatedAt = new Date().toISOString();
			} else {
				state.balances.set(key, { amount: BigInt(amount), version: 1, updatedAt: new Date().toISOString() });
			}
			return [{ amount: state.balances.get(key)!.amount.toString() }];
		}
		if (sql.trimStart().startsWith('INSERT') && sql.includes('DO NOTHING')) {
			const [st, sid, cur] = params as [string, string, string];
			const key = balKey(st, sid, cur);
			if (!state.balances.has(key)) {
				state.balances.set(key, { amount: 0n, version: 1, updatedAt: new Date().toISOString() });
			}
			return [];
		}
		if (sql.trimStart().startsWith('UPDATE')) {
			const [st, sid, cur, cost, floor] = params as [string, string, string, string, string];
			const row = state.balances.get(balKey(st, sid, cur));
			if (!row || row.amount - BigInt(cost) < BigInt(floor)) return [];
			row.amount -= BigInt(cost);
			row.version += 1;
			row.updatedAt = new Date().toISOString();
			return [{ amount: row.amount.toString() }];
		}
		const [st, sid, cur] = params as [string, string, string];
		const row = state.balances.get(balKey(st, sid, cur));
		if (!row) return [];
		if (sql.includes('version')) {
			return [{ amount: row.amount.toString(), version: String(row.version), updatedAt: row.updatedAt }];
		}
		return [{ amount: row.amount.toString() }];
	}

	if (sql.includes('fonderie_wallet_grants')) {
		const [st, sid, cur, period, amount] = params as [string, string, string, string, string?];
		const key = `${st}|${sid}|${cur}|${period}`;
		if (sql.trimStart().startsWith('INSERT')) {
			if (state.grants.has(key)) return [];
			state.grants.set(key, BigInt(amount ?? '0'));
			return [{ period }];
		}
		return state.grants.has(key) ? [{ period }] : [];
	}

	if (sql.includes('fonderie_wallet_customers')) {
		const ckey = (st: unknown, sid: unknown, prov: unknown) => `${st}|${sid}|${prov}`;
		if (sql.trimStart().startsWith('INSERT')) {
			// upsert: [st, sid, provider, providerCustomerId, rearm]
			const [st, sid, prov, pcid, rearm] = params as [string, string, string, string, boolean];
			const existing = state.customers.get(ckey(st, sid, prov));
			state.customers.set(ckey(st, sid, prov), {
				providerCustomerId: pcid,
				disabled: rearm ? false : (existing?.disabled ?? false),
				failures: rearm ? 0 : (existing?.failures ?? 0),
				lastRechargeAt: existing?.lastRechargeAt ?? null, // purchase doesn't reset the cooldown
				pendingKey: existing?.pendingKey ?? null,
			});
			return [];
		}
		if (sql.includes('make_interval')) {
			// claim: [st, sid, provider, cooldownSeconds]
			const [st, sid, prov, cooldown] = params as [string, string, string, number];
			const row = state.customers.get(ckey(st, sid, prov));
			if (!row || row.disabled) return [];
			const now = Date.now();
			if (row.lastRechargeAt !== null && now - row.lastRechargeAt < Number(cooldown) * 1000) return [];
			row.lastRechargeAt = now;
			return [
				{
					providerCustomerId: row.providerCustomerId,
					claimedAt: new Date(now).toISOString(),
					pendingKey: row.pendingKey,
				},
			];
		}
		if (sql.includes('pending_recharge_key = NULL')) {
			// clearPendingRechargeKey: [st, sid, provider]
			const [st, sid, prov] = params as [string, string, string];
			const row = state.customers.get(ckey(st, sid, prov));
			if (row) row.pendingKey = null;
			return [];
		}
		if (sql.includes('pending_recharge_key = $4')) {
			// setPendingRechargeKey: [st, sid, provider, key]
			const [st, sid, prov, k] = params as [string, string, string, string];
			const row = state.customers.get(ckey(st, sid, prov));
			if (row) row.pendingKey = k;
			return [];
		}
		if (sql.includes('consecutive_failures + 1')) {
			// recordFailure: [st, sid, provider, maxFailures]
			const [st, sid, prov, maxF] = params as [string, string, string, number];
			const row = state.customers.get(ckey(st, sid, prov));
			if (!row) return [];
			row.failures += 1;
			row.disabled = row.failures >= Number(maxF);
			return [{ autoRechargeDisabled: row.disabled }];
		}
		if (sql.includes('consecutive_failures = 0')) {
			// recordSuccess: [st, sid, provider]
			const [st, sid, prov] = params as [string, string, string];
			const row = state.customers.get(ckey(st, sid, prov));
			if (row) row.failures = 0;
			return [];
		}
		return [];
	}

	throw new Error(`walletEmulator: unhandled SQL: ${sql.slice(0, 80)}`);
}

// Serializing emulator: transactions queue on one chain (the row-lock model)
// and roll back to a snapshot on throw.
function walletEmulator(): IStoreAdapter & { state: IWalletState } {
	const state: IWalletState = { balances: new Map(), ledger: [], grants: new Map(), customers: new Map(), seq: 0 };
	let chain: Promise<unknown> = Promise.resolve();

	const snapshot = (): IWalletState => ({
		balances: new Map([...state.balances].map(([k, v]) => [k, { ...v }])),
		ledger: [...state.ledger],
		grants: new Map(state.grants),
		customers: new Map([...state.customers].map(([k, v]) => [k, { ...v }])),
		seq: state.seq,
	});
	const restore = (s: IWalletState) => {
		state.balances = s.balances;
		state.ledger = s.ledger;
		state.grants = s.grants;
		state.customers = s.customers;
		state.seq = s.seq;
	};

	const adapter = {
		state,
		async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
			return runWalletSql(state, sql, params) as T[];
		},
		async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
			const run = chain.then(async () => {
				const snap = snapshot();
				try {
					return await fn(adapter as IStoreAdapter);
				} catch (err) {
					restore(snap);
					throw err;
				}
			});
			chain = run.catch(() => {});
			return run;
		},
	};
	return adapter as IStoreAdapter & { state: IWalletState };
}

// Interleaving emulator: NO transaction serialization and NO rollback — the
// worst-case backend. Only the conditional UPDATE's own atomicity remains,
// which is exactly the second safety layer under test.
function interleavedEmulator(): IStoreAdapter & { state: IWalletState } {
	const state: IWalletState = { balances: new Map(), ledger: [], grants: new Map(), customers: new Map(), seq: 0 };
	const adapter = {
		state,
		async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
			// Yield first so concurrent callers interleave between statements.
			await new Promise((r) => setImmediate(r));
			return runWalletSql(state, sql, params) as T[];
		},
		async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
			return fn(adapter as IStoreAdapter);
		},
	};
	return adapter as IStoreAdapter & { state: IWalletState };
}

const USER = { subscriberType: 'user' as SubscriberType, subscriberId: '3b241101-e2bb-4255-8caf-4136c566a962', currency: 'USD' };
const OTHER = { subscriberType: 'user' as SubscriberType, subscriberId: '9f8b1c60-0b1e-4d5a-9c3e-2a7b8d1e4f00', currency: 'USD' };

// ── creditWallet ──────────────────────────────────────────────────

test('creditWallet: creates balance and ledger row', async () => {
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	const res = await creditWallet(
		{ ...USER, amount: 1000n, type: 'purchase', idempotencyKey: 'k1', providerTxId: 'pi_1' },
		store,
	);
	assert.equal(res.balance, 1000n);
	assert.equal(res.duplicate, false);
	assert.equal(store.state.ledger.length, 1);
	assert.equal(store.state.ledger[0]!.amount, 1000n);
	assert.equal(store.state.ledger[0]!.balanceAfter, 1000n);
	assert.equal(store.state.ledger[0]!.type, 'purchase');
	assert.equal(store.state.ledger[0]!.providerTxId, 'pi_1');
});

test('creditWallet: replayed idempotency key is a no-op', async () => {
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await creditWallet({ ...USER, amount: 500n, idempotencyKey: 'k1' }, store);
	const replay = await creditWallet({ ...USER, amount: 500n, idempotencyKey: 'k1' }, store);
	assert.equal(replay.balance, 500n);
	assert.equal(replay.duplicate, true);
	assert.equal(store.state.ledger.length, 1);
});

test('creditWallet: key reused for a different subscriber throws DuplicateTransactionError', async () => {
	const { creditWallet } = await import('../services/wallet');
	const { DuplicateTransactionError } = await import('../errors');
	const store = walletEmulator();
	await creditWallet({ ...USER, amount: 500n, idempotencyKey: 'shared' }, store);
	await assert.rejects(
		creditWallet({ ...OTHER, amount: 500n, idempotencyKey: 'shared' }, store),
		DuplicateTransactionError,
	);
});

test('creditWallet: zero amount is a no-op without a ledger row', async () => {
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	const res = await creditWallet({ ...USER, amount: 0n, idempotencyKey: 'k0' }, store);
	assert.equal(res.balance, 0n);
	assert.equal(store.state.ledger.length, 0);
});

test('creditWallet: negative amount is rejected', async () => {
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await assert.rejects(creditWallet({ ...USER, amount: -5n, idempotencyKey: 'kneg' }, store), /positive/);
});

test('creditWallet RACE: concurrent identical replays apply exactly once', async () => {
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	const results = await Promise.all(
		Array.from({ length: 5 }, () => creditWallet({ ...USER, amount: 250n, idempotencyKey: 'same' }, store)),
	);
	assert.equal(store.state.ledger.length, 1);
	for (const r of results) assert.equal(r.balance, 250n);
	assert.equal(results.filter((r) => !r.duplicate).length, 1);
});

// ── debitWallet ───────────────────────────────────────────────────

async function fund(store: IStoreAdapter, amount: bigint): Promise<void> {
	const { creditWallet } = await import('../services/wallet');
	await creditWallet({ ...USER, amount, type: 'grant', idempotencyKey: `fund-${amount}` }, store);
}

test('debitWallet: deducts and writes a negative ledger row', async () => {
	const { debitWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await fund(store, 1000n);
	const res = await debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1', description: 'sms' }, store);
	assert.equal(res.balance, 700n);
	const row = store.state.ledger.at(-1)!;
	assert.equal(row.amount, -300n);
	assert.equal(row.balanceAfter, 700n);
	assert.equal(row.type, 'usage');
});

test('debitWallet: insufficient funds throws and leaves no trace', async () => {
	const { debitWallet } = await import('../services/wallet');
	const { InsufficientFundsError } = await import('../errors');
	const store = walletEmulator();
	await fund(store, 100n);
	await assert.rejects(debitWallet({ ...USER, amount: 101n, idempotencyKey: 'd1' }, store), (err: unknown) => {
		assert.ok(err instanceof InsufficientFundsError);
		assert.equal(err.available, 100n);
		assert.equal(err.required, 101n);
		return true;
	});
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 100n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 0);
});

test('debitWallet: exact-to-zero is allowed, one past zero is not (block at zero)', async () => {
	const { debitWallet } = await import('../services/wallet');
	const { InsufficientFundsError } = await import('../errors');
	const store = walletEmulator();
	await fund(store, 100n);
	const res = await debitWallet({ ...USER, amount: 100n, idempotencyKey: 'd1' }, store);
	assert.equal(res.balance, 0n);
	await assert.rejects(debitWallet({ ...USER, amount: 1n, idempotencyKey: 'd2' }, store), InsufficientFundsError);
});

test('debitWallet: overdraftLimit lets the balance go negative to the floor only', async () => {
	const { debitWallet } = await import('../services/wallet');
	const { InsufficientFundsError } = await import('../errors');
	const store = walletEmulator();
	await fund(store, 100n);
	const res = await debitWallet({ ...USER, amount: 150n, overdraftLimit: 50n, idempotencyKey: 'd1' }, store);
	assert.equal(res.balance, -50n);
	await assert.rejects(
		debitWallet({ ...USER, amount: 1n, overdraftLimit: 50n, idempotencyKey: 'd2' }, store),
		InsufficientFundsError,
	);
});

test('debitWallet: replayed idempotency key does not double-debit', async () => {
	const { debitWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await fund(store, 1000n);
	await debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1' }, store);
	const replay = await debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1' }, store);
	assert.equal(replay.balance, 700n);
	assert.equal(replay.duplicate, true);
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 1);
});

test('debitWallet: zero-cost debit writes no ledger row', async () => {
	const { debitWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await fund(store, 100n);
	const res = await debitWallet({ ...USER, amount: 0n, idempotencyKey: 'd0' }, store);
	assert.equal(res.balance, 100n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 0);
});

test('debitWallet: missing balance row counts as zero', async () => {
	const { debitWallet } = await import('../services/wallet');
	const { InsufficientFundsError } = await import('../errors');
	const store = walletEmulator();
	await assert.rejects(debitWallet({ ...USER, amount: 1n, idempotencyKey: 'd1' }, store), InsufficientFundsError);
});

test('debitWallet RACE: two concurrent 600-debits on a 1000 balance — exactly one wins', async () => {
	const { debitWallet } = await import('../services/wallet');
	const { InsufficientFundsError } = await import('../errors');
	const store = walletEmulator();
	await fund(store, 1000n);
	const results = await Promise.allSettled([
		debitWallet({ ...USER, amount: 600n, idempotencyKey: 'race-a' }, store),
		debitWallet({ ...USER, amount: 600n, idempotencyKey: 'race-b' }, store),
	]);
	const ok = results.filter((r) => r.status === 'fulfilled');
	const failed = results.filter((r) => r.status === 'rejected');
	assert.equal(ok.length, 1);
	assert.equal(failed.length, 1);
	assert.ok((failed[0] as PromiseRejectedResult).reason instanceof InsufficientFundsError);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 400n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 1);
});

test('debitWallet RACE: N concurrent debits never overspend', async () => {
	const { debitWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await fund(store, 1000n);
	const results = await Promise.allSettled(
		Array.from({ length: 12 }, (_, i) => debitWallet({ ...USER, amount: 100n, idempotencyKey: `n-${i}` }, store)),
	);
	const ok = results.filter((r) => r.status === 'fulfilled').length;
	assert.equal(ok, 10, `expected exactly 10 successful debits, got ${ok}`);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 0n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 10);
});

test('debitWallet RACE: conditional UPDATE holds the floor even without transaction serialization', async () => {
	const { creditWallet, debitWallet } = await import('../services/wallet');
	const store = interleavedEmulator();
	await creditWallet({ ...USER, amount: 1000n, type: 'grant', idempotencyKey: 'fund' }, store);
	const results = await Promise.allSettled([
		debitWallet({ ...USER, amount: 600n, idempotencyKey: 'i-a' }, store),
		debitWallet({ ...USER, amount: 600n, idempotencyKey: 'i-b' }, store),
	]);
	const ok = results.filter((r) => r.status === 'fulfilled').length;
	assert.equal(ok, 1, 'the single-statement floor check must reject the second debit');
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 400n);
});

// ── ledger consistency ────────────────────────────────────────────

test('ledger: signed amounts always sum to the balance', async () => {
	const { creditWallet, debitWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await creditWallet({ ...USER, amount: 1000n, type: 'purchase', idempotencyKey: 'c1' }, store);
	await debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1' }, store);
	await creditWallet({ ...USER, amount: 50n, type: 'refund', idempotencyKey: 'c2' }, store);
	await debitWallet({ ...USER, amount: 750n, idempotencyKey: 'd2' }, store);
	const sum = store.state.ledger.reduce((acc, l) => acc + l.amount, 0n);
	assert.equal(sum, 0n);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 0n);
	assert.equal(store.state.ledger.at(-1)!.balanceAfter, 0n);
});

// ── ensurePeriodicGrant ───────────────────────────────────────────

test('ensurePeriodicGrant: grants once per period', async () => {
	const { ensurePeriodicGrant } = await import('../services/wallet');
	const store = walletEmulator();
	const first = await ensurePeriodicGrant({ ...USER, amount: 500n, period: '2026-09' }, store);
	assert.equal(first.granted, true);
	assert.equal(first.balance, 500n);
	const second = await ensurePeriodicGrant({ ...USER, amount: 500n, period: '2026-09' }, store);
	assert.equal(second.granted, false);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 500n);
	assert.equal(store.state.ledger.length, 1);
	assert.equal(store.state.ledger[0]!.type, 'grant');
});

test('ensurePeriodicGrant: a new period grants again', async () => {
	const { ensurePeriodicGrant } = await import('../services/wallet');
	const store = walletEmulator();
	await ensurePeriodicGrant({ ...USER, amount: 500n, period: '2026-09' }, store);
	const next = await ensurePeriodicGrant({ ...USER, amount: 500n, period: '2026-10' }, store);
	assert.equal(next.granted, true);
	assert.equal(next.balance, 1000n);
});

test('ensurePeriodicGrant RACE: concurrent requests grant exactly once', async () => {
	const { ensurePeriodicGrant } = await import('../services/wallet');
	const store = walletEmulator();
	const results = await Promise.all(
		Array.from({ length: 10 }, () => ensurePeriodicGrant({ ...USER, amount: 500n, period: '2026-09' }, store)),
	);
	assert.equal(results.filter((r) => r.granted).length, 1);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 500n);
	assert.equal(store.state.ledger.length, 1);
});

test('currentGrantPeriod: month, day, and ISO week formats', async () => {
	const { currentGrantPeriod } = await import('../services/wallet');
	const d = new Date('2026-09-04T12:00:00Z');
	assert.equal(currentGrantPeriod('month', d), '2026-09');
	assert.equal(currentGrantPeriod('day', d), '2026-09-04');
	assert.equal(currentGrantPeriod('week', d), '2026-W36');
	// ISO week-numbering year boundaries.
	assert.equal(currentGrantPeriod('week', new Date('2023-01-01T00:00:00Z')), '2022-W52');
	assert.equal(currentGrantPeriod('week', new Date('2024-12-30T00:00:00Z')), '2025-W01');
});

// ── balance + ledger reads ────────────────────────────────────────

test('getWalletBalance: zero for an unknown subscriber', async () => {
	const { getWalletBalance } = await import('../services/wallet');
	const store = walletEmulator();
	const bal = await getWalletBalance(USER, store);
	assert.equal(bal.balance, 0n);
	assert.equal(bal.version, 0);
	assert.equal(bal.updatedAt, null);
});

test('getWalletLedger: paginates newest-first with a stable cursor', async () => {
	const { creditWallet, getWalletLedger } = await import('../services/wallet');
	const store = walletEmulator();
	for (let i = 0; i < 5; i++) {
		await creditWallet({ ...USER, amount: BigInt(i + 1), idempotencyKey: `p-${i}` }, store);
	}
	const page1 = await getWalletLedger({ ...USER, limit: 2 }, store);
	assert.equal(page1.entries.length, 2);
	assert.equal(page1.entries[0]!.amount, 5n); // newest first
	assert.ok(page1.nextCursor);

	const { decodeLedgerCursor } = await import('../services/wallet');
	const page2 = await getWalletLedger(
		{ ...USER, limit: 2, cursor: decodeLedgerCursor(page1.nextCursor!)! },
		store,
	);
	assert.equal(page2.entries.length, 2);
	assert.equal(page2.entries[0]!.amount, 3n);
	assert.ok(page2.nextCursor);

	const page3 = await getWalletLedger(
		{ ...USER, limit: 2, cursor: decodeLedgerCursor(page2.nextCursor!)! },
		store,
	);
	assert.equal(page3.entries.length, 1);
	assert.equal(page3.entries[0]!.amount, 1n);
	assert.equal(page3.nextCursor, null);
});

test('decodeLedgerCursor: rejects garbage, non-UUID ids, and oversized cursors', async () => {
	const { decodeLedgerCursor, encodeLedgerCursor } = await import('../services/wallet');
	const uuid = '3b241101-e2bb-4255-8caf-4136c566a962';
	assert.equal(decodeLedgerCursor('not-base64-json'), null);
	assert.equal(decodeLedgerCursor(Buffer.from('{"a":1}').toString('base64url')), null);
	assert.equal(decodeLedgerCursor(Buffer.from(`["not-a-date","${uuid}"]`).toString('base64url')), null);
	// A crafted non-UUID id would otherwise hit the $5::uuid cast as a 500.
	assert.equal(
		decodeLedgerCursor(Buffer.from('["2026-01-01T00:00:00Z","not-a-uuid"]').toString('base64url')),
		null,
	);
	assert.equal(decodeLedgerCursor('A'.repeat(300)), null);
	const round = decodeLedgerCursor(encodeLedgerCursor('2026-09-04T00:00:00.000Z', uuid));
	assert.deepEqual(round, { createdAt: '2026-09-04T00:00:00.000Z', id: uuid });
	// Postgres' own text format (microsecond precision) must survive — the
	// cursor carries it to avoid millisecond truncation between pages.
	const pg = decodeLedgerCursor(encodeLedgerCursor('2026-09-04 18:50:50.888123+00', uuid));
	assert.equal(pg?.createdAt, '2026-09-04 18:50:50.888123+00');
});

// ── wallet DTOs serialize bigint as string ────────────────────────

test('toWalletTransactionDTO: JSON-safe string amounts', async () => {
	const { toWalletTransactionDTO, toWalletDTO } = await import('../dtos/billing');
	const entry: IWalletLedgerEntry = {
		id: 'x',
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		currency: 'USD',
		type: 'usage',
		amount: -750n,
		balanceAfter: 250n,
		description: 'sms',
		idempotencyKey: 'k',
		metadata: { taskId: 't1' },
		providerTxId: null,
		createdAt: '2026-09-04T00:00:00.000Z',
	};
	const dto = toWalletTransactionDTO(entry);
	assert.equal(dto.amount, '-750');
	assert.equal(dto.balanceAfter, '250');
	assert.doesNotThrow(() => JSON.stringify(dto));
	assert.doesNotThrow(() => JSON.stringify(toWalletDTO(10n ** 20n, 'USD', 2)));
	assert.equal(toWalletDTO(10n ** 20n, 'USD', 2).balance, '100000000000000000000');
});

// ── grantWalletSchema ─────────────────────────────────────────────

test('grantWalletSchema: accepts digit-string and integer amounts as bigint', async () => {
	const { grantWalletSchema } = await import('../schemas');
	const base = {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		idempotencyKey: 'grant-1',
	};
	const fromString = grantWalletSchema.parse({ ...base, amount: '100000000000000000000' });
	assert.equal(fromString.amount, 10n ** 20n);
	const fromNumber = grantWalletSchema.parse({ ...base, amount: 500 });
	assert.equal(fromNumber.amount, 500n);
});

test('grantWalletSchema: rejects zero, negatives, floats, bad UUIDs, missing keys', async () => {
	const { grantWalletSchema } = await import('../schemas');
	const base = {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		idempotencyKey: 'grant-1',
	};
	assert.equal(grantWalletSchema.safeParse({ ...base, amount: '0' }).success, false);
	assert.equal(grantWalletSchema.safeParse({ ...base, amount: '-5' }).success, false);
	assert.equal(grantWalletSchema.safeParse({ ...base, amount: 1.5 }).success, false);
	assert.equal(
		grantWalletSchema.safeParse({ ...base, amount: '100', subscriberId: 'not-a-uuid' }).success,
		false,
	);
	assert.equal(
		grantWalletSchema.safeParse({ subscriberType: 'user', subscriberId: USER.subscriberId, amount: '100' })
			.success,
		false,
	);
});

// ── walletController ──────────────────────────────────────────────

const walletConfig = (overrides: Partial<IBillingConfig['wallet']> = {}): IBillingConfig =>
	({
		provider: { name: 'stub' } as IBillingConfig['provider'],
		plans: [],
		successUrl: 'https://app.example.com/success',
		cancelUrl: 'https://app.example.com/cancel',
		wallet: { currency: 'USD', precision: 2, ...overrides },
	}) as IBillingConfig;

function makeCtx(opts: { url?: string; user?: unknown; body?: unknown; headers?: Record<string, string>; workspace?: unknown } = {}): import('@fonderie/core').IFonderieContext {
	return {
		meta: { body: opts.body ?? {} },
		user: 'user' in opts ? opts.user : { id: USER.subscriberId, email: 'a@b.com' },
		workspace: opts.workspace ?? null,
		tenant: null,
		request: new Request(opts.url ?? 'http://localhost/billing/wallet', { headers: opts.headers ?? {} }),
	} as any;
}

test('walletController.get: returns balance as a string with currency and precision', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await creditWallet({ ...USER, amount: 1999n, idempotencyKey: 'c1' }, store);
	const ctrl = walletController(store, walletConfig());
	const res = await ctrl.get(makeCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.deepEqual(body.result.wallet, { balance: '1999', currency: 'USD', precision: 2 });
});

test('walletController.get: 400 without a subscriber', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const ctrl = walletController(walletEmulator(), walletConfig());
	const res = await ctrl.get(makeCtx({ user: null }));
	assert.equal(res.status, 400);
});

test('walletController.get: ?currency selects a specific balance', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await creditWallet({ ...USER, currency: 'EUR', amount: 42n, idempotencyKey: 'e1' }, store);
	const ctrl = walletController(store, walletConfig());
	const res = await ctrl.get(makeCtx({ url: 'http://localhost/billing/wallet?currency=eur' }));
	const body = (await res.json()) as any;
	assert.equal(body.result.wallet.currency, 'EUR');
	assert.equal(body.result.wallet.balance, '42');
});

test('walletController.transactions: pages and exposes nextCursor', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	for (let i = 0; i < 3; i++) await creditWallet({ ...USER, amount: 10n, idempotencyKey: `t-${i}` }, store);
	const ctrl = walletController(store, walletConfig());
	const res = await ctrl.transactions(makeCtx({ url: 'http://localhost/billing/wallet/transactions?limit=2' }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result.transactions.length, 2);
	assert.equal(typeof body.result.transactions[0].amount, 'string');
	assert.ok(body.result.nextCursor);
});

test('walletController.transactions: 422 on malformed cursor or bad limit', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const ctrl = walletController(walletEmulator(), walletConfig());
	const bad = await ctrl.transactions(
		makeCtx({ url: 'http://localhost/billing/wallet/transactions?cursor=%%%garbage' }),
	);
	assert.equal(bad.status, 422);
	const badLimit = await ctrl.transactions(
		makeCtx({ url: 'http://localhost/billing/wallet/transactions?limit=0' }),
	);
	assert.equal(badLimit.status, 422);
});

test('walletController.grant: credits and reports the new balance', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const store = walletEmulator();
	const ctrl = walletController(store, walletConfig());
	// Body as grantWalletSchema leaves it post-validate: amount is bigint.
	const res = await ctrl.grant(
		makeCtx({
			body: {
				subscriberType: 'user',
				subscriberId: USER.subscriberId,
				amount: 500n,
				idempotencyKey: 'support-1',
			},
		}),
	);
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result.balance, '500');
	assert.equal(body.result.duplicate, false);
	assert.equal(store.state.ledger[0]!.type, 'grant');
});

test('walletController.grant: 409 when the key belongs to a different subscriber', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await creditWallet({ ...OTHER, amount: 1n, idempotencyKey: 'clash' }, store);
	const ctrl = walletController(store, walletConfig());
	const res = await ctrl.grant(
		makeCtx({
			body: {
				subscriberType: 'user',
				subscriberId: USER.subscriberId,
				amount: 500n,
				idempotencyKey: 'clash',
			},
		}),
	);
	assert.equal(res.status, 409);
});

// ── credit packs ──────────────────────────────────────────────────

const PACKS = [
	{ id: 'small', name: 'Small pack', credits: 5000n, priceAmount: 499n },
	{ id: 'retired', name: 'Retired pack', credits: 1n, priceAmount: 1n, active: false },
	{ id: 'priced', name: 'Priced pack', credits: 20000n, priceAmount: 1999n, priceId: 'price_pack_20k', currency: 'EUR' },
];

test('findCreditPack: resolves active packs only', async () => {
	const { findCreditPack } = await import('../services/credit-packs');
	const config = walletConfig({ creditPacks: PACKS });
	assert.equal(findCreditPack('small', config)?.credits, 5000n);
	assert.equal(findCreditPack('retired', config), null);
	assert.equal(findCreditPack('nope', config), null);
});

test('syncCreditPacksToDB: upserts packs with stringified bigint amounts', async () => {
	const { syncCreditPacksToDB } = await import('../services/credit-packs');
	let captured: { sql: string; params: unknown[] } | null = null;
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			captured = { sql, params: params ?? [] };
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	await syncCreditPacksToDB(walletConfig({ creditPacks: PACKS }), store);
	assert.ok(captured!.sql.includes('INSERT INTO fonderie_credit_packs'));
	assert.ok(captured!.sql.includes('ON CONFLICT (id) DO UPDATE'));
	// First pack: default currency, stringified amounts, active default true.
	assert.deepEqual(captured!.params.slice(0, 8), [
		'small', 'Small pack', 'USD', '5000', '499', null, true, '{}',
	]);
	// Retired pack keeps active: false; priced pack keeps its own currency/priceId.
	assert.equal(captured!.params[14], false);
	assert.equal(captured!.params[18], 'EUR');
	assert.equal(captured!.params[21], 'price_pack_20k');
});

// ── wallet checkout ───────────────────────────────────────────────

function paymentProvider(overrides: Record<string, unknown> = {}) {
	const calls: { payment?: unknown; customer?: unknown } = {};
	const provider = {
		name: 'stub',
		async createCustomer(opts: unknown) {
			calls.customer = opts;
			return { customerId: 'cus_1' };
		},
		async createPaymentCheckoutSession(opts: unknown) {
			calls.payment = opts;
			return { url: 'https://checkout.stub.com/pay_1', sessionId: 'cs_test_1' };
		},
		async constructEvent() {
			return { type: 'stub', subscription: null };
		},
		...overrides,
	};
	return { provider: provider as unknown as IBillingConfig['provider'], calls };
}

test('walletController.checkout: creates a payment session with snapshot metadata', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { provider, calls } = paymentProvider();
	const config = { ...walletConfig({ creditPacks: PACKS }), provider } as IBillingConfig;
	const ctrl = walletController(billingStore(walletEmulator()), config);
	const res = await ctrl.checkout(makeCtx({ body: { packId: 'small' } }));
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.result.url, 'https://checkout.stub.com/pay_1');
	assert.equal(body.result.sessionId, 'cs_test_1');
	const opts = calls.payment as any;
	assert.equal(opts.amount, 499n);
	assert.equal(opts.currency, 'USD');
	assert.equal(opts.name, 'Small pack');
	assert.deepEqual(opts.metadata, {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		packId: 'small',
		credits: '5000',
		currency: 'USD',
	});
});

test('walletController.checkout: pack with a provider priceId passes it through', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { provider, calls } = paymentProvider();
	const config = { ...walletConfig({ creditPacks: PACKS }), provider } as IBillingConfig;
	const ctrl = walletController(billingStore(walletEmulator()), config);
	await ctrl.checkout(makeCtx({ body: { packId: 'priced' } }));
	const opts = calls.payment as any;
	assert.equal(opts.priceId, 'price_pack_20k');
	assert.equal(opts.currency, 'EUR');
	assert.equal(opts.metadata.credits, '20000');
});

test('walletController.checkout: 422 for unknown or inactive packs', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { provider } = paymentProvider();
	const config = { ...walletConfig({ creditPacks: PACKS }), provider } as IBillingConfig;
	const ctrl = walletController(walletEmulator(), config);
	assert.equal((await ctrl.checkout(makeCtx({ body: { packId: 'nope' } }))).status, 422);
	assert.equal((await ctrl.checkout(makeCtx({ body: { packId: 'retired' } }))).status, 422);
});

test('walletController.checkout: 501 when the provider lacks one-time payments', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { provider } = paymentProvider({ createPaymentCheckoutSession: undefined });
	const config = { ...walletConfig({ creditPacks: PACKS }), provider } as IBillingConfig;
	const ctrl = walletController(billingStore(walletEmulator()), config);
	const res = await ctrl.checkout(makeCtx({ body: { packId: 'small' } }));
	assert.equal(res.status, 501);
});

// ── payment webhook ───────────────────────────────────────────────

function paymentEvent(metadata: Record<string, string>, over: Record<string, unknown> = {}) {
	return {
		type: 'checkout.session.completed',
		subscription: null,
		payment: {
			sessionId: 'cs_evt_1',
			providerTxId: 'pi_1',
			amountTotal: 499n,
			currency: 'usd',
			metadata,
			...over,
		},
	};
}

const walletMeta = {
	subscriberType: 'user',
	subscriberId: USER.subscriberId,
	packId: 'small',
	credits: '5000',
	currency: 'USD',
};

function webhookCtx(): import('@fonderie/core').IFonderieContext {
	return {
		meta: {},
		user: null,
		workspace: null,
		tenant: null,
		request: new Request('http://localhost/billing/webhook/payment', {
			method: 'POST',
			headers: { 'stripe-signature': 't=1,v1=stub' },
			body: '{}',
		}),
	} as any;
}

function webhookConfig(event: unknown, over: Record<string, unknown> = {}) {
	const { provider } = paymentProvider({
		constructEvent: async () => event,
	});
	return {
		...walletConfig({ webhookSecret: 'whsec_pay', creditPacks: PACKS, ...over }),
		provider,
	} as IBillingConfig;
}

test('payment webhook: credits the buyer wallet from snapshot metadata', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)));
	const res = await ctrl.handle(webhookCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.received, true);
	assert.equal(body.duplicate, false);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 5000n);
	const row = store.state.ledger[0]!;
	assert.equal(row.type, 'purchase');
	assert.equal(row.providerTxId, 'pi_1');
	assert.equal(row.idempotencyKey, 'stub:checkout:cs_evt_1');
	assert.equal(row.metadata['packId'], 'small');
});

test('payment webhook: replayed event is idempotent', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)));
	await ctrl.handle(webhookCtx());
	const replay = await ctrl.handle(webhookCtx());
	const body = (await replay.json()) as any;
	assert.equal(replay.status, 200);
	assert.equal(body.duplicate, true);
	assert.equal(store.state.ledger.length, 1);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 5000n);
});

test('payment webhook: ignores events without a payment', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(
		store,
		webhookConfig({ type: 'customer.subscription.updated', subscription: null }),
	);
	const res = await ctrl.handle(webhookCtx());
	assert.equal(res.status, 200);
	assert.equal(store.state.ledger.length, 0);
});

test('payment webhook: ignores one-time payments that are not wallet purchases', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(store, webhookConfig(paymentEvent({ order: '42' })));
	const res = await ctrl.handle(webhookCtx());
	assert.equal(res.status, 200);
	assert.equal(store.state.ledger.length, 0);
});

test('payment webhook: 422 for a wallet purchase with malformed metadata', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(
		store,
		webhookConfig(paymentEvent({ ...walletMeta, credits: '5,000' })),
	);
	const res = await ctrl.handle(webhookCtx());
	assert.equal(res.status, 422);
	assert.equal(store.state.ledger.length, 0);
});

test('payment webhook: 500 without a secret, 400 without a signature or on bad signature', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();

	const noSecret = { ...webhookConfig(paymentEvent(walletMeta)) } as IBillingConfig;
	delete (noSecret.wallet as { webhookSecret?: string }).webhookSecret;
	assert.equal((await paymentWebhookController(store, noSecret).handle(webhookCtx())).status, 500);

	const ctrl = paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)));
	const unsigned = {
		...webhookCtx(),
		request: new Request('http://localhost/billing/webhook/payment', { method: 'POST', body: '{}' }),
	} as any;
	assert.equal((await ctrl.handle(unsigned)).status, 400);

	const { provider } = paymentProvider({
		constructEvent: async () => {
			throw new Error('bad signature');
		},
	});
	const badSig = { ...webhookConfig(null), provider } as IBillingConfig;
	assert.equal((await paymentWebhookController(store, badSig).handle(webhookCtx())).status, 400);
});

test('payment webhook: never falls back to the subscription webhookSecret', async () => {
	// Per-endpoint secrets exist so a delivery captured for one endpoint can't
	// replay against the other — a missing wallet secret is a config error,
	// not a cue to reuse the subscription endpoint's secret.
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const { provider } = paymentProvider({
		constructEvent: async () => paymentEvent(walletMeta),
	});
	const config = {
		...walletConfig({ creditPacks: PACKS }),
		webhookSecret: 'whsec_subscription',
		provider,
	} as IBillingConfig;
	const res = await paymentWebhookController(store, config).handle(webhookCtx());
	assert.equal(res.status, 500);
	assert.equal(store.state.ledger.length, 0);
});

test('payment webhook: unpaid delayed-notification completion does not credit', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(
		store,
		webhookConfig(paymentEvent(walletMeta, { paymentStatus: 'unpaid' })),
	);
	const res = await ctrl.handle(webhookCtx());
	const body = (await res.json()) as any;
	assert.equal(res.status, 200);
	assert.equal(body.pending, true);
	assert.equal(store.state.ledger.length, 0);

	// The paid follow-up (async_payment_succeeded) then credits normally.
	const paid = paymentWebhookController(
		store,
		webhookConfig(paymentEvent(walletMeta, { paymentStatus: 'paid' })),
	);
	assert.equal((await paid.handle(webhookCtx())).status, 200);
	assert.equal(store.state.ledger.length, 1);
});

test('payment webhook: pins the metadata-trust boundary — credits metadata amount even when amountTotal mismatches', async () => {
	// The credited amount is the snapshot our checkout wrote, not what the
	// provider says was paid; the mismatch is recorded in ledger metadata for
	// reconciliation. This test pins that boundary so a future validation has
	// a failing test to change.
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const ctrl = paymentWebhookController(
		store,
		webhookConfig(paymentEvent(walletMeta, { amountTotal: 1n, currency: 'eur' })),
	);
	assert.equal((await ctrl.handle(webhookCtx())).status, 200);
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 5000n);
	assert.equal(store.state.ledger[0]!.metadata['amountPaid'], '1');
	assert.equal(store.state.ledger[0]!.metadata['paymentCurrency'], 'eur');
});

test('payment webhook: 409 when the session key was already used for another subscriber', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await creditWallet({ ...OTHER, amount: 1n, idempotencyKey: 'stub:checkout:cs_evt_1' }, store);
	const ctrl = paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)));
	const res = await ctrl.handle(webhookCtx());
	assert.equal(res.status, 409);
});

// ── Stripe payment-session normalization ──────────────────────────

test('normalizePaymentSession: string and expanded payment_intent, null-safe', async () => {
	const { normalizePaymentSession } = await import('../providers/stripe');
	const full = normalizePaymentSession({
		id: 'cs_1',
		mode: 'payment',
		payment_intent: 'pi_9',
		customer: 'cus_9',
		amount_total: 499,
		currency: 'usd',
		payment_status: 'paid',
		metadata: { packId: 'small' },
	});
	assert.deepEqual(full, {
		sessionId: 'cs_1',
		providerTxId: 'pi_9',
		customerId: 'cus_9',
		amountTotal: 499n,
		currency: 'usd',
		paymentStatus: 'paid',
		metadata: { packId: 'small' },
	});

	// customer as an expanded object, and absent → null.
	const expanded = normalizePaymentSession({ id: 'cs_2', payment_intent: { id: 'pi_x' }, customer: { id: 'cus_x' } });
	assert.equal(expanded.providerTxId, 'pi_x');
	assert.equal(expanded.customerId, 'cus_x');

	const bare = normalizePaymentSession({ id: 'cs_3' });
	assert.equal(bare.providerTxId, null);
	assert.equal(bare.customerId, null);
	assert.equal(bare.amountTotal, null);
	assert.equal(bare.currency, null);
	assert.equal(bare.paymentStatus, null);
	assert.deepEqual(bare.metadata, {});
});

// ── plan wallet economics (phase 3) ───────────────────────────────

function billingStore(
	emu: ReturnType<typeof walletEmulator>,
	subscription: unknown = null,
	// 'userId|workspaceId' pairs holding active membership rows.
	members: Set<string> = new Set(),
): IStoreAdapter {
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions')) {
				return (subscription ? [subscription] : []) as T[];
			}
			if (sql.includes('fonderie_role_user_workspaces')) {
				return (members.has(`${params?.[0]}|${params?.[1]}`) ? [{ ok: 1 }] : []) as T[];
			}
			return emu.query<T>(sql, params);
		},
		transaction: (fn) => emu.transaction(fn),
	};
	return store;
}

const FREE_PLAN = {
	name: 'free',
	wallet: { grantAmount: 50n, rates: { task: { cost: 5n }, 'sms:send': { cost: 75n, unit: 'msg' } } },
};
const UNLIMITED_PLAN = { name: 'unlimited', wallet: { rates: { task: { cost: 0n } } } };

function planWalletConfig(plans: unknown[]): IBillingConfig {
	return { ...walletConfig(), plans } as IBillingConfig;
}

test('resolvePlanWallet: null without the global opt-in or a plan wallet, defaults otherwise', async () => {
	const { resolvePlanWallet } = await import('../services/wallet');
	const config = planWalletConfig([FREE_PLAN]);
	const noOptIn = { ...config } as IBillingConfig;
	delete (noOptIn as { wallet?: unknown }).wallet;
	assert.equal(resolvePlanWallet(FREE_PLAN as any, noOptIn), null);
	assert.equal(resolvePlanWallet({ name: 'plain' } as any, config), null);

	const resolved = resolvePlanWallet(FREE_PLAN as any, config)!;
	assert.equal(resolved.currency, 'USD');
	assert.equal(resolved.precision, 2);
	assert.equal(resolved.overdraftLimit, 0n);
	assert.equal(resolved.grantAmount, 50n);
	assert.equal(resolved.grantPeriod, 'month');

	const custom = resolvePlanWallet(
		{ name: 'x', wallet: { currency: 'EUR', precision: 0, overdraftLimit: 10n, grantPeriod: 'week' } } as any,
		config,
	)!;
	assert.equal(custom.currency, 'EUR');
	assert.equal(custom.precision, 0);
	assert.equal(custom.overdraftLimit, 10n);
	assert.equal(custom.grantAmount, null);
	assert.equal(custom.grantPeriod, 'week');
});

async function runWithBilling(
	config: IBillingConfig,
	store: IStoreAdapter,
	ctxOpts: Parameters<typeof makeCtx>[0] = {},
) {
	const { withBilling } = await import('../middlewares/billing');
	const { MemoryCounterBackend } = await import('../backends/memory');
	const middleware = withBilling(store, config, new MemoryCounterBackend());
	const ctx = makeCtx(ctxOpts);
	let nextCalled = false;
	const response = await middleware(ctx, async () => {
		nextCalled = true;
		return new Response();
	});
	return { ctx, nextCalled, response };
}

test('withBilling: lazily grants once per period and exposes the wallet context', async () => {
	const emu = walletEmulator();
	const config = planWalletConfig([FREE_PLAN]);
	const store = billingStore(emu);

	const first = await runWithBilling(config, store);
	assert.equal(first.nextCalled, true);
	const wallet = (first.ctx.meta['billing'] as any).wallet;
	assert.equal(wallet.balance, 50n);
	assert.equal(wallet.currency, 'USD');
	assert.equal(wallet.rates['sms:send'].cost, 75n);
	assert.equal(emu.state.ledger.filter((l) => l.type === 'grant').length, 1);

	// Second request in the same period: no second grant, same balance.
	const second = await runWithBilling(config, store);
	assert.equal((second.ctx.meta['billing'] as any).wallet.balance, 50n);
	assert.equal(emu.state.ledger.filter((l) => l.type === 'grant').length, 1);
});

test('withBilling: no wallet context without plan wallet or global opt-in', async () => {
	const emu = walletEmulator();
	const noPlanWallet = await runWithBilling(planWalletConfig([{ name: 'plain' }]), billingStore(emu));
	assert.equal((noPlanWallet.ctx.meta['billing'] as any).wallet, undefined);

	const noOptIn = planWalletConfig([FREE_PLAN]);
	delete (noOptIn as { wallet?: unknown }).wallet;
	const disabled = await runWithBilling(noOptIn, billingStore(emu));
	assert.equal((disabled.ctx.meta['billing'] as any).wallet, undefined);
	assert.equal(emu.state.ledger.length, 0);
});

test('withBilling: wallet failures are non-fatal', async () => {
	const config = planWalletConfig([FREE_PLAN]);
	const broken: IStoreAdapter = {
		query: async <T = unknown>(sql: string): Promise<T[]> => {
			if (sql.includes('fonderie_subscriptions')) return [] as T[];
			throw new Error('wallet backend down');
		},
		transaction: async (fn) => fn(broken),
	};
	const { ctx, nextCalled } = await runWithBilling(config, broken);
	assert.equal(nextCalled, true);
	assert.equal((ctx.meta['billing'] as any).wallet, undefined);
});

// ── workspace membership enforcement (withBilling) ────────────────

const WS_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

test('withBilling: 403 for a header-supplied workspace the user is not a member of', async () => {
	const emu = walletEmulator();
	const store = billingStore(emu, null, new Set()); // no memberships at all
	const { ctx, nextCalled, response } = await runWithBilling(planWalletConfig([FREE_PLAN]), store, {
		headers: { 'x-workspace-id': WS_ID },
	});
	assert.equal(nextCalled, false);
	assert.equal(response.status, 403);
	assert.equal(ctx.meta['billing'], undefined);
	assert.equal(emu.state.ledger.length, 0); // no grant minted for the forged workspace
});

test('withBilling: members reach the workspace wallet; the grant lands on the workspace', async () => {
	const emu = walletEmulator();
	const store = billingStore(emu, null, new Set([`${USER.subscriberId}|${WS_ID}`]));
	const { ctx, nextCalled } = await runWithBilling(planWalletConfig([FREE_PLAN]), store, {
		headers: { 'x-workspace-id': WS_ID },
	});
	assert.equal(nextCalled, true);
	const billing = ctx.meta['billing'] as any;
	assert.deepEqual(billing.subscriber, { type: 'workspace', id: WS_ID });
	assert.equal(billing.wallet.balance, 50n);
	assert.equal(emu.state.balances.get(`workspace|${WS_ID}|USD`)!.amount, 50n);
});

test('withBilling: a header matching the verified ctx.workspace skips the membership query', async () => {
	const emu = walletEmulator();
	// Empty membership set: if withBilling re-queried membership it would 403 —
	// passing proves the pre-verified ctx.workspace short-circuits the check.
	const store = billingStore(emu, null, new Set());
	const { nextCalled } = await runWithBilling(planWalletConfig([FREE_PLAN]), store, {
		headers: { 'x-workspace-id': WS_ID },
		workspace: { id: WS_ID },
	});
	assert.equal(nextCalled, true);
});

test('withBilling: anonymous requests naming a workspace get no billing context at all', async () => {
	const emu = walletEmulator();
	const store = billingStore(emu, null, new Set([`${USER.subscriberId}|${WS_ID}`]));
	const { ctx, nextCalled } = await runWithBilling(planWalletConfig([FREE_PLAN]), store, {
		user: null,
		headers: { 'x-workspace-id': WS_ID },
	});
	assert.equal(nextCalled, true); // public routes keep working
	assert.equal(ctx.meta['billing'], undefined); // but no counters, no grants, no wallet
	assert.equal(emu.state.ledger.length, 0);
});

test('withBilling: membership check fails closed when the workspaces table is missing', async () => {
	const emu = walletEmulator();
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			if (sql.includes('fonderie_role_user_workspaces')) {
				throw new Error('relation "fonderie_role_user_workspaces" does not exist');
			}
			if (sql.includes('fonderie_subscriptions')) return [] as T[];
			return emu.query<T>(sql, params);
		},
		transaction: (fn) => emu.transaction(fn),
	};
	const { response, nextCalled } = await runWithBilling(planWalletConfig([FREE_PLAN]), store, {
		headers: { 'x-workspace-id': WS_ID },
	});
	assert.equal(nextCalled, false);
	assert.equal(response.status, 403);
});

// ── subscription-holding plan resolution ──────────────────────────

const PRO_PLAN = {
	name: 'pro',
	wallet: { grantAmount: 500n, rates: { task: { cost: 1n } } },
};

const proSubscription = (status: string) => ({
	id: 'sub-1',
	subscriberType: 'user',
	subscriberId: USER.subscriberId,
	plan: 'pro',
	interval: 'month',
	status,
	providerCustomerId: 'cus_1',
	providerSubscriptionId: 'sub_p1',
	currentPeriodStart: null,
	currentPeriodEnd: null,
	cancelAtPeriodEnd: false,
	trialEndsAt: null,
	createdAt: '2026-09-01T00:00:00.000Z',
});

test("withBilling: a subscription resolves ITS plan's wallet, not the fallback plan's", async () => {
	const emu = walletEmulator();
	const store = billingStore(emu, proSubscription('active'));
	const { ctx } = await runWithBilling(planWalletConfig([FREE_PLAN, PRO_PLAN]), store);
	const wallet = (ctx.meta['billing'] as any).wallet;
	assert.equal(wallet.balance, 500n); // pro's grant, not free's 50n
	assert.equal(wallet.rates['task'].cost, 1n);
	assert.equal(wallet.rates['sms:send'], undefined);
});

test('withBilling: past_due subscribers keep their wallet but receive no new grant', async () => {
	const emu = walletEmulator();
	const store = billingStore(emu, proSubscription('past_due'));
	const { ctx, nextCalled } = await runWithBilling(planWalletConfig([FREE_PLAN, PRO_PLAN]), store);
	assert.equal(nextCalled, true);
	const wallet = (ctx.meta['billing'] as any).wallet;
	assert.equal(wallet.balance, 0n); // no grant extended while payment fails
	assert.equal(emu.state.ledger.length, 0);
});

// ── round-2 review fixes ──────────────────────────────────────────

test('wallet reads follow the plan wallet currency and precision, not just the global default', async () => {
	// Writes land in the plan bucket; the read endpoints must read the same
	// bucket or a funded subscriber sees a zero USD wallet.
	const { walletController } = await import('../controllers/wallet.controller');
	const emu = walletEmulator();
	const eurPlan = { name: 'eur', wallet: { currency: 'eur', precision: 0, grantAmount: 1000n } };
	const config = planWalletConfig([eurPlan]);
	const store = billingStore(emu);
	const { ctx } = await runWithBilling(config, store); // grants 1000 EUR

	const res = await walletController(store, config).get(ctx);
	const body = (await res.json()) as any;
	assert.deepEqual(body.result.wallet, { balance: '1000', currency: 'EUR', precision: 0 });

	const txRes = await walletController(store, config).transactions(ctx);
	const txBody = (await txRes.json()) as any;
	assert.equal(txBody.result.transactions.length, 1);
});

test('walletController.checkout: reuses the subscription provider customer', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { provider, calls } = paymentProvider();
	const config = { ...walletConfig({ creditPacks: PACKS }), provider } as IBillingConfig;
	const store = billingStore(walletEmulator(), proSubscription('active'));
	const res = await walletController(store, config).checkout(makeCtx({ body: { packId: 'small' } }));
	assert.equal(res.status, 200);
	assert.equal(calls.customer, undefined, 'must not create a second provider customer');
	assert.equal((calls.payment as any).customerId, 'cus_1');
});

test('currency codes normalize to one canonical bucket across grant, read, and config', async () => {
	const { grantWalletSchema } = await import('../schemas');
	const { walletController } = await import('../controllers/wallet.controller');
	const emu = walletEmulator();
	const config = walletConfig();
	const ctrl = walletController(billingStore(emu), config);

	// A support grant in ' usd ' must not open a case- or padding-distinct
	// bucket — and interior garbage is rejected, never repaired.
	const parsed = grantWalletSchema.parse({
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		amount: '300',
		currency: ' usd ',
		idempotencyKey: 'norm-1',
	});
	assert.equal(parsed.currency, 'USD');
	assert.equal(
		grantWalletSchema.safeParse({
			subscriberType: 'user',
			subscriberId: USER.subscriberId,
			amount: '300',
			currency: 'U SD',
			idempotencyKey: 'norm-2',
		}).success,
		false,
	);
	await ctrl.grant(makeCtx({ body: parsed }));
	assert.ok(emu.state.balances.has(`user|${USER.subscriberId}|USD`));
	assert.equal(emu.state.balances.size, 1);

	// ...and reads reach it whatever the query-param casing or padding.
	const res = await ctrl.get(makeCtx({ url: 'http://localhost/billing/wallet?currency=%20usd%20' }));
	assert.equal(((await res.json()) as any).result.wallet.balance, '300');
});

// ── idempotency-conflict and rollback paths, deterministically ────

// A store built on the same SQL engine as walletEmulator, with a query
// interceptor and snapshot rollback — used to force the exact failure
// orderings the serializing emulator's happy paths never reach.
function interceptingEmulator(
	intercept: (sql: string, params: unknown[], state: IWalletState) => unknown[] | undefined | never,
): IStoreAdapter & { state: IWalletState } {
	const state: IWalletState = { balances: new Map(), ledger: [], grants: new Map(), customers: new Map(), seq: 0 };
	let chain: Promise<unknown> = Promise.resolve();
	const snapshot = (): IWalletState => ({
		balances: new Map([...state.balances].map(([k, v]) => [k, { ...v }])),
		ledger: [...state.ledger],
		grants: new Map(state.grants),
		customers: new Map([...state.customers].map(([k, v]) => [k, { ...v }])),
		seq: state.seq,
	});
	const restore = (s: IWalletState) => {
		state.balances = s.balances;
		state.ledger = s.ledger;
		state.grants = s.grants;
		state.customers = s.customers;
		state.seq = s.seq;
	};
	const adapter = {
		state,
		async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
			const hijacked = intercept(sql, params ?? [], state);
			if (hijacked !== undefined) return hijacked as T[];
			return runWalletSql(state, sql, params) as T[];
		},
		async transaction<T>(fn: (tx: IStoreAdapter) => Promise<T>): Promise<T> {
			const run = chain.then(async () => {
				const snap = snapshot();
				try {
					return await fn(adapter as IStoreAdapter);
				} catch (err) {
					restore(snap);
					throw err;
				}
			});
			chain = run.catch(() => {});
			return run;
		},
	};
	return adapter as IStoreAdapter & { state: IWalletState };
}

test('creditWallet: a 23505 losing race (pre-check miss, insert conflict) rolls back and reports duplicate', async () => {
	const { creditWallet } = await import('../services/wallet');
	// Simulate READ COMMITTED invisibility: the pre-check for the key misses
	// once even though the row exists, so the mutation proceeds and the ledger
	// INSERT hits the UNIQUE constraint.
	let misses = 1;
	const store = interceptingEmulator((sql) => {
		if (sql.includes('idempotency_key = $1') && misses > 0) {
			misses--;
			return [];
		}
		return undefined;
	});
	await creditWallet({ ...USER, amount: 100n, idempotencyKey: 'seed' }, store);
	misses = 1; // next pre-check for 'seed' will miss
	const replay = await creditWallet({ ...USER, amount: 100n, idempotencyKey: 'seed' }, store);
	assert.equal(replay.duplicate, true);
	assert.equal(replay.balance, 100n); // the doubled upsert was rolled back
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 100n);
	assert.equal(store.state.ledger.length, 1);
});

test('debitWallet: a 23505 losing race rolls the applied deduction back', async () => {
	const { creditWallet, debitWallet } = await import('../services/wallet');
	let misses = 0;
	const store = interceptingEmulator((sql) => {
		if (sql.includes('idempotency_key = $1') && misses > 0) {
			misses--;
			return [];
		}
		return undefined;
	});
	await creditWallet({ ...USER, amount: 1000n, idempotencyKey: 'fund' }, store);
	await debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1' }, store);
	misses = 1;
	const replay = await debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1' }, store);
	assert.equal(replay.duplicate, true);
	assert.equal(replay.balance, 700n); // debited once, not twice
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 1);
});

test('debitWallet: a non-idempotency ledger failure rolls the balance back and rethrows', async () => {
	const { creditWallet, debitWallet } = await import('../services/wallet');
	let failLedger = false;
	const store = interceptingEmulator((sql) => {
		if (failLedger && sql.includes('fonderie_wallet_ledger') && sql.trimStart().startsWith('INSERT')) {
			throw new Error('disk full');
		}
		return undefined;
	});
	await creditWallet({ ...USER, amount: 1000n, idempotencyKey: 'fund' }, store);
	failLedger = true;
	await assert.rejects(debitWallet({ ...USER, amount: 300n, idempotencyKey: 'd1' }, store), /disk full/);
	// The balance UPDATE succeeded before the ledger INSERT failed — the
	// transaction must have restored it: never a balance write without its row.
	assert.equal(store.state.balances.get(`user|${USER.subscriberId}|USD`)!.amount, 1000n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'usage').length, 0);
});

test('creditWallet: a NOT NULL violation is an error, not a fake duplicate', async () => {
	const { creditWallet } = await import('../services/wallet');
	const store = walletEmulator();
	// Plain-JS callers can omit the key despite the types.
	await assert.rejects(
		creditWallet({ ...USER, amount: 100n, idempotencyKey: undefined as unknown as string }, store),
		/idempotencyKey is required/,
	);
	assert.equal(store.state.ledger.length, 0);
});

// ── ledger cursor: same-timestamp tiebreak ────────────────────────

test('getWalletLedger: rows sharing a timestamp paginate without loss via the id tiebreak', async () => {
	const { creditWallet, getWalletLedger, decodeLedgerCursor } = await import('../services/wallet');
	const store = walletEmulator();
	for (let i = 0; i < 3; i++) {
		await creditWallet({ ...USER, amount: BigInt(i + 1), idempotencyKey: `t-${i}` }, store);
	}
	// Force all three rows onto one timestamp — only the id orders them now.
	const shared = store.state.ledger[0]!.createdAt;
	for (const row of store.state.ledger) (row as { createdAt: string }).createdAt = shared;

	const seen: string[] = [];
	let cursor: string | null = null;
	do {
		const page = await getWalletLedger(
			{ ...USER, limit: 1, ...(cursor ? { cursor: decodeLedgerCursor(cursor)! } : {}) },
			store,
		);
		seen.push(...page.entries.map((e) => e.id));
		cursor = page.nextCursor;
	} while (cursor);
	assert.equal(new Set(seen).size, 3, `every row exactly once, got ${seen.join(',')}`);
});

// ── composed route chains ─────────────────────────────────────────

function composeChain(handlers: unknown[], ctx: import('@fonderie/core').IFonderieContext): Promise<Response> {
	const run = (i: number): Promise<Response> => {
		const handler = handlers[i] as (c: unknown, n: () => Promise<Response>) => Promise<Response>;
		return handler(ctx, () => run(i + 1));
	};
	return run(0);
}

test('POST /billing/wallet/grant: the composed route chain enforces token then validation then handler', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const emu = walletEmulator();
	const routes = buildBillingRoutes(billingStore(emu), walletConfig({ adminToken: 'ops-token' }));
	const grant = routes.find(([m, p]) => m === 'POST' && p === '/billing/wallet/grant')!;
	const handlers = grant.slice(2);

	// Wrong bearer token → 401 before validation or the handler run.
	const denied = await composeChain(handlers, makeCtx({ headers: { authorization: 'Bearer nope' } }));
	assert.equal(denied.status, 401);
	assert.equal(emu.state.ledger.length, 0);

	// Right token, invalid body → 422 from validate(grantWalletSchema).
	const invalid = await composeChain(
		handlers,
		makeCtx({ headers: { authorization: 'Bearer ops-token' }, body: { amount: '100' } }),
	);
	assert.equal(invalid.status, 422);

	// Right token, valid body → the grant lands.
	const ok = await composeChain(
		handlers,
		makeCtx({
			headers: { authorization: 'Bearer ops-token' },
			body: {
				subscriberType: 'user',
				subscriberId: USER.subscriberId,
				amount: '250',
				idempotencyKey: 'ops-1',
			},
		}),
	);
	assert.equal(ok.status, 200);
	assert.equal(emu.state.ledger[0]!.amount, 250n);
});

test('walletCheckoutSchema: rejects empty, missing, and non-string packIds', async () => {
	const { walletCheckoutSchema } = await import('../schemas');
	assert.equal(walletCheckoutSchema.safeParse({}).success, false);
	assert.equal(walletCheckoutSchema.safeParse({ packId: '' }).success, false);
	assert.equal(walletCheckoutSchema.safeParse({ packId: 42 }).success, false);
	assert.equal(walletCheckoutSchema.safeParse({ packId: 'x'.repeat(101) }).success, false);
	assert.equal(walletCheckoutSchema.parse({ packId: ' small ' }).packId, 'small');
});

test('walletController.get: serves a workspace subscriber wallet', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { creditWallet } = await import('../services/wallet');
	const emu = walletEmulator();
	await creditWallet(
		{ subscriberType: 'workspace', subscriberId: WS_ID, currency: 'USD', amount: 777n, idempotencyKey: 'ws' },
		emu,
	);
	const ctrl = walletController(billingStore(emu), walletConfig());
	const res = await ctrl.get(makeCtx({ headers: { 'x-workspace-id': WS_ID } }));
	const body = (await res.json()) as any;
	assert.equal(body.result.wallet.balance, '777');
});

test('debitWalletForMetric: fractional or non-positive quantities are rejected up front', async () => {
	const { debitWalletForMetric } = await import('../helpers');
	const emu = walletEmulator();
	const store = billingStore(emu);
	const { ctx } = await runWithBilling(planWalletConfig([FREE_PLAN]), store);
	await assert.rejects(
		debitWalletForMetric(ctx, 'task', { idempotencyKey: 'q', quantity: 1.5 }, store),
		/positive integer/,
	);
	await assert.rejects(
		debitWalletForMetric(ctx, 'task', { idempotencyKey: 'q', quantity: 0 }, store),
		/positive integer/,
	);
});

test('requireWalletBalance: 402 when the rate exceeds the balance, passes otherwise', async () => {
	const { requireWalletBalance } = await import('../helpers');
	const walletCtx = (balance: bigint, overdraft = 0n): any => ({
		meta: {
			billing: {
				subscriber: { type: 'user', id: USER.subscriberId },
				plan: 'free',
				active: true,
				statuses: {},
				wallet: {
					balance,
					currency: 'USD',
					precision: 2,
					overdraftLimit: overdraft,
					rates: { task: { cost: 5n }, free: { cost: 0n } },
				},
			},
		},
	});
	const next = async () => new Response();

	const blocked = await requireWalletBalance('task')(walletCtx(4n), next);
	assert.equal(blocked.status, 402);
	const body = (await blocked.json()) as any;
	assert.equal(body.reason, 'INSUFFICIENT_CREDITS');
	assert.equal(body.details.cost, '5');
	assert.equal(body.details.balance, '4');

	assert.equal((await requireWalletBalance('task')(walletCtx(5n), next)).status, 200);
	// Overdraft opens the floor.
	assert.equal((await requireWalletBalance('task')(walletCtx(0n, 5n), next)).status, 200);
	// Zero-cost and unpriced metrics fail open.
	assert.equal((await requireWalletBalance('free')(walletCtx(0n), next)).status, 200);
	assert.equal((await requireWalletBalance('unknown')(walletCtx(0n), next)).status, 200);
	// No wallet context (billing off / plan without wallet) fails open.
	assert.equal((await requireWalletBalance('task')({ meta: {} } as any, next)).status, 200);
});

test('getWalletStatus / getWalletRate: read the cached context', async () => {
	const { getWalletStatus, getWalletRate } = await import('../helpers');
	const ctx: any = {
		meta: {
			billing: {
				subscriber: { type: 'user', id: USER.subscriberId },
				plan: 'free',
				active: true,
				statuses: {},
				wallet: { balance: 10n, currency: 'USD', precision: 2, overdraftLimit: 0n, rates: { task: { cost: 5n } } },
			},
		},
	};
	assert.equal(getWalletStatus(ctx)?.balance, 10n);
	assert.equal(getWalletRate(ctx, 'task'), 5n);
	assert.equal(getWalletRate(ctx, 'unknown'), null);
	assert.equal(getWalletStatus({ meta: {} } as any), null);
});

test('debitWalletForMetric: charges rate x quantity with an idempotency key', async () => {
	const { debitWalletForMetric } = await import('../helpers');
	const emu = walletEmulator();
	const config = planWalletConfig([FREE_PLAN]);
	const store = billingStore(emu);
	const { ctx } = await runWithBilling(config, store); // grants 50

	const result = await debitWalletForMetric(
		ctx,
		'task',
		{ idempotencyKey: 'task-42', quantity: 3, metadata: { taskId: '42' } },
		store,
	);
	assert.equal(result!.balance, 35n); // 50 - 3*5
	const row = emu.state.ledger.at(-1)!;
	assert.equal(row.amount, -15n);
	assert.equal(row.metadata['metric'], 'task');
	assert.equal(row.metadata['quantity'], 3);

	// Replay is a no-op.
	const replay = await debitWalletForMetric(ctx, 'task', { idempotencyKey: 'task-42', quantity: 3 }, store);
	assert.equal(replay!.balance, 35n);
	assert.equal(replay!.duplicate, true);
});

test('debitWalletForMetric: unlimited plans (zero rate) charge nothing and write no ledger row', async () => {
	const { debitWalletForMetric } = await import('../helpers');
	const emu = walletEmulator();
	const config = planWalletConfig([UNLIMITED_PLAN]);
	const store = billingStore(emu);
	const { ctx } = await runWithBilling(config, store);

	const result = await debitWalletForMetric(ctx, 'task', { idempotencyKey: 'u-1' }, store);
	assert.equal(result, null);
	assert.equal(await debitWalletForMetric(ctx, 'unpriced', { idempotencyKey: 'u-2' }, store), null);
	assert.equal(emu.state.ledger.filter((l) => l.type === 'usage').length, 0);
});

test('debitWalletForMetric: throws InsufficientFundsError past the plan floor', async () => {
	const { debitWalletForMetric } = await import('../helpers');
	const { InsufficientFundsError } = await import('../errors');
	const emu = walletEmulator();
	const config = planWalletConfig([FREE_PLAN]);
	const store = billingStore(emu);
	const { ctx } = await runWithBilling(config, store); // balance 50
	await assert.rejects(
		debitWalletForMetric(ctx, 'task', { idempotencyKey: 'big', quantity: 11 }, store),
		InsufficientFundsError,
	);
});

test('syncPlansToDB: serializes plan wallet config with stringified bigints', async () => {
	const { syncPlansToDB } = await import('../services/plans');
	let captured: { sql: string; params: unknown[] } | null = null;
	const store: IStoreAdapter = {
		query: async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
			captured = { sql, params: params ?? [] };
			return [] as T[];
		},
		transaction: async (fn) => fn(store),
	};
	await syncPlansToDB(planWalletConfig([FREE_PLAN, { name: 'plain' }]), store);
	assert.ok(captured!.sql.includes('wallet           = EXCLUDED.wallet'));
	const walletJson = JSON.parse(captured!.params[9] as string);
	assert.equal(walletJson.grantAmount, '50');
	assert.equal(walletJson.rates['sms:send'].cost, '75');
	assert.equal(captured!.params[19], null); // plan without wallet
});

// ── requireAdminToken ─────────────────────────────────────────────

test('requireAdminToken: 401 without or with a wrong token, passes with the right one', async () => {
	const { requireAdminToken } = await import('../middlewares/admin-token');
	const middleware = requireAdminToken('secret-token');
	let called = false;
	const next = async () => {
		called = true;
		return new Response();
	};

	const missing = await middleware(makeCtx(), next);
	assert.equal(missing.status, 401);

	const wrong = await middleware(makeCtx({ headers: { authorization: 'Bearer nope' } }), next);
	assert.equal(wrong.status, 401);
	assert.equal(called, false);

	await middleware(makeCtx({ headers: { authorization: 'Bearer secret-token' } }), next);
	assert.equal(called, true);
});

// ── route registration is opt-in ──────────────────────────────────

test('buildBillingRoutes: no wallet routes without config.wallet', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const config = { ...walletConfig() };
	delete (config as { wallet?: unknown }).wallet;
	const routes = buildBillingRoutes(walletEmulator(), config);
	assert.equal(routes.filter(([, path]) => String(path).startsWith('/billing/wallet')).length, 0);
});

test('buildBillingRoutes: wallet reads register with config.wallet; grant needs adminToken', async () => {
	const { buildBillingRoutes } = await import('../routes');
	const withoutToken = buildBillingRoutes(walletEmulator(), walletConfig());
	const paths = withoutToken.map(([method, path]) => `${method} ${path}`);
	assert.ok(paths.includes('GET /billing/wallet'));
	assert.ok(paths.includes('GET /billing/wallet/transactions'));
	assert.ok(!paths.includes('POST /billing/wallet/grant'));

	const withToken = buildBillingRoutes(walletEmulator(), walletConfig({ adminToken: 'tok' }));
	const grant = withToken.find(([method, path]) => method === 'POST' && path === '/billing/wallet/grant');
	assert.ok(grant);
	// Guard + validation middleware precede the handler.
	assert.equal(grant!.length - 2, 3);
});

// ── domain events (Phase 1): wallet credits, purchases, grants ────

function recordingBus() {
	const calls: { type: string; payload: any }[] = [];
	return {
		bus: { emit: async (type: string, payload: unknown) => { calls.push({ type, payload }); } } as any,
		calls,
	};
}

test('payment webhook: emits credit_pack.purchased + wallet.credited on a real credit', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const { EVENT_KEYS } = await import('../config');
	const store = walletEmulator();
	const { bus, calls } = recordingBus();
	const ctrl = paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)), bus);
	await ctrl.handle(webhookCtx());
	const types = calls.map((c) => c.type);
	assert.ok(types.includes(EVENT_KEYS.creditPackPurchased));
	assert.ok(types.includes(EVENT_KEYS.walletCredited));
	const purchased = calls.find((c) => c.type === EVENT_KEYS.creditPackPurchased)!;
	assert.equal(purchased.payload.subscriberType, 'user');
	assert.equal(purchased.payload.credits, '5000');
	assert.equal(purchased.payload.balanceAfter, '5000');
	assert.equal(purchased.payload.packId, 'small');
	assert.equal(typeof purchased.payload.currency, 'string');
});

test('payment webhook: a replayed event emits nothing (no double receipt)', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	const first = recordingBus();
	await paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)), first.bus).handle(webhookCtx());
	const replay = recordingBus();
	await paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta)), replay.bus).handle(webhookCtx());
	assert.ok(first.calls.length >= 2);
	assert.equal(replay.calls.length, 0, 'duplicate credit must not re-emit');
});

test('wallet grant: emits wallet.credited (source manual-grant) on a real credit only', async () => {
	const { walletController } = await import('../controllers/wallet.controller');
	const { EVENT_KEYS } = await import('../config');
	const store = walletEmulator();
	const { bus, calls } = recordingBus();
	const ctrl = walletController(store, walletConfig(), bus);
	const body = { subscriberType: 'user', subscriberId: USER.subscriberId, amount: 500n, idempotencyKey: 'g-1' };
	await ctrl.grant(makeCtx({ body }));
	assert.equal(calls.length, 1);
	assert.equal(calls[0]!.type, EVENT_KEYS.walletCredited);
	assert.equal(calls[0]!.payload.source, 'manual-grant');
	assert.equal(calls[0]!.payload.credits, '500');
	// Replay: same key → duplicate → no emit.
	await ctrl.grant(makeCtx({ body }));
	assert.equal(calls.length, 1, 'duplicate grant must not re-emit');
});

test('withBilling: emits grant.applied + wallet.credited when a periodic grant lands, once per period', async () => {
	const { EVENT_KEYS } = await import('../config');
	const emu = walletEmulator();
	const { bus, calls } = recordingBus();
	const config = planWalletConfig([FREE_PLAN]);
	const store = billingStore(emu);
	// runWithBilling builds withBilling(store, config, backend, bus) — thread the bus.
	const { withBilling } = await import('../middlewares/billing');
	const { MemoryCounterBackend } = await import('../backends/memory');
	const mw = withBilling(store, config, new MemoryCounterBackend(), bus);
	const run = async () => {
		const ctx = makeCtx({});
		await mw(ctx, async () => new Response());
		return ctx;
	};
	await run();
	const types = calls.map((c) => c.type);
	assert.ok(types.includes(EVENT_KEYS.grantApplied));
	assert.ok(types.includes(EVENT_KEYS.walletCredited));
	const g = calls.find((c) => c.type === EVENT_KEYS.grantApplied)!;
	assert.equal(g.payload.credits, '50');
	assert.equal(g.payload.balanceAfter, '50');
	// Same period again → no new grant → no new emits.
	const before = calls.length;
	await run();
	assert.equal(calls.length, before, 'a second request in the same period must not re-emit');
});

test('billing events round-trip a real EventBus to an in-process subscriber (webhooks-forwardable shape)', async () => {
	const { EventBus, MemoryTransport } = await import('@fonderie/events');
	const { walletController } = await import('../controllers/wallet.controller');
	const { EVENT_KEYS } = await import('../config');
	const bus = new EventBus(new MemoryTransport());
	await bus.start();
	const received: any[] = [];
	bus.on(EVENT_KEYS.walletCredited, async (payload: any) => { received.push(payload); }, 'test-subscriber');

	const store = walletEmulator();
	const ctrl = walletController(store, walletConfig(), bus);
	await ctrl.grant(makeCtx({
		body: { subscriberType: 'workspace', subscriberId: '11111111-2222-4333-8444-555566667777', amount: 500n, idempotencyKey: 'rt-1' },
	}));
	await new Promise((r) => setTimeout(r, 10));
	await bus.stop();

	assert.equal(received.length, 1, 'in-process subscriber received the billing event');
	// The webhooks dispatcher fans out on a top-level workspaceId — present for a workspace subscriber.
	assert.equal(typeof received[0].workspaceId, 'string');
	assert.equal(received[0].workspaceId, '11111111-2222-4333-8444-555566667777');
});

// ── communication integrity (Phase 2): notifications + readiness ──

test('notifyBilling: no bus is a silent no-op (never throws)', async () => {
	const { notifyBilling } = await import('../services/notify');
	await notifyBilling(undefined, walletConfig(), {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		type: 'billing.payment-receipt',
		data: {},
	});
});

test('notifyBilling: no resolveRecipient → nothing emitted', async () => {
	const { notifyBilling } = await import('../services/notify');
	const { bus, calls } = recordingBus();
	await notifyBilling(bus, walletConfig(), {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		type: 'billing.payment-receipt',
		data: {},
	});
	assert.equal(calls.length, 0);
});

test('notifyBilling: an unresolved recipient (null) emits nothing', async () => {
	const { notifyBilling } = await import('../services/notify');
	const { bus, calls } = recordingBus();
	const config = { ...walletConfig(), resolveRecipient: () => null } as IBillingConfig;
	await notifyBilling(bus, config, {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		type: 'billing.payment-receipt',
		data: {},
	});
	assert.equal(calls.length, 0);
});

test('notifyBilling: a throwing resolver is swallowed (money op is never failed)', async () => {
	const { notifyBilling } = await import('../services/notify');
	const { bus, calls } = recordingBus();
	const config = {
		...walletConfig(),
		resolveRecipient: () => {
			throw new Error('directory down');
		},
	} as IBillingConfig;
	await notifyBilling(bus, config, {
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		type: 'billing.payment-receipt',
		data: {},
	});
	assert.equal(calls.length, 0);
});

test('notifyBilling: emits NOTIFICATION_EVENT with a fully-shaped recipient', async () => {
	const { notifyBilling } = await import('../services/notify');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	// Resolver returns only an email; phone/deviceToken must be filled to null.
	const config = { ...walletConfig(), resolveRecipient: () => ({ email: 'a@b.com' }) } as IBillingConfig;
	await notifyBilling(bus, config, {
		subscriberType: 'workspace',
		subscriberId: 'ws-1',
		type: 'billing.payment-receipt',
		data: { amount: '499' },
	});
	assert.equal(calls.length, 1);
	assert.equal(calls[0]!.type, NOTIFICATION_EVENT);
	assert.equal(calls[0]!.payload.type, 'billing.payment-receipt');
	assert.deepEqual(calls[0]!.payload.recipient, { email: 'a@b.com', phone: null, deviceToken: null });
	assert.equal(calls[0]!.payload.data.amount, '499');
});

test('payment webhook: sends a payment-receipt notice on a real credit, none on replay', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { MESSAGE_KEYS } = await import('../config');
	const store = walletEmulator();
	const cfg = {
		...webhookConfig(paymentEvent(walletMeta)),
		resolveRecipient: () => ({ email: 'buyer@x.com' }),
	} as IBillingConfig;
	const first = recordingBus();
	await paymentWebhookController(store, cfg, first.bus).handle(webhookCtx());
	const receipts = first.calls.filter(
		(c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.paymentReceipt,
	);
	assert.equal(receipts.length, 1, 'one receipt on a real credit');
	assert.equal(receipts[0]!.payload.data.packId, 'small');
	assert.equal(receipts[0]!.payload.data.credits, '5000');
	assert.equal(receipts[0]!.payload.data.balanceAfter, '5000');
	assert.equal(receipts[0]!.payload.recipient.email, 'buyer@x.com');
	// Replay → duplicate credit → no second receipt.
	const replay = recordingBus();
	await paymentWebhookController(store, cfg, replay.bus).handle(webhookCtx());
	assert.equal(
		replay.calls.filter((c) => c.type === NOTIFICATION_EVENT).length,
		0,
		'a replayed credit must not re-send the receipt',
	);
});

const LOW_PLAN = {
	name: 'low',
	wallet: { lowBalanceAt: 100n, rates: { task: { cost: 5n } } },
};

test('withBilling: low balance signals once per crossing and re-arms after recovery', async () => {
	const { EVENT_KEYS, MESSAGE_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { creditWallet, debitWallet } = await import('../services/wallet');
	const { withBilling } = await import('../middlewares/billing');
	const { MemoryCounterBackend } = await import('../backends/memory');

	const emu = walletEmulator();
	const store = billingStore(emu);
	// Unique subscriber id — the low-balance dedup Set is module-level.
	const uid = '5c3d1e00-0000-4000-8000-000000000abc';
	const sub = { subscriberType: 'user' as SubscriberType, subscriberId: uid, currency: 'USD' };
	const config = {
		...planWalletConfig([LOW_PLAN]),
		resolveRecipient: () => ({ email: 'z@z.com' }),
	} as IBillingConfig;
	const { bus, calls } = recordingBus();
	const mw = withBilling(store, config, new MemoryCounterBackend(), bus);
	const run = async () => {
		const ctx = makeCtx({ user: { id: uid, email: 'z@z.com' } });
		await mw(ctx, async () => new Response());
	};
	const lowCount = () => calls.filter((c) => c.type === EVENT_KEYS.walletLowBalance).length;
	const noticeCount = () =>
		calls.filter((c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.creditsLow)
			.length;

	// Balance 50 (≤ 100) → fires the domain signal + the customer notice once.
	await creditWallet({ ...sub, amount: 50n, idempotencyKey: 'lb-c1' }, emu);
	await run();
	assert.equal(lowCount(), 1);
	assert.equal(noticeCount(), 1);
	const low = calls.find((c) => c.type === EVENT_KEYS.walletLowBalance)!;
	assert.equal(low.payload.balance, '50');
	assert.equal(low.payload.threshold, '100');

	// Same session, still low → no repeat.
	await run();
	assert.equal(lowCount(), 1, 'deduped within a single crossing');

	// Recover above the threshold → the flag clears, no new signal.
	await creditWallet({ ...sub, amount: 100n, idempotencyKey: 'lb-c2' }, emu); // 150
	await run();
	assert.equal(lowCount(), 1);

	// Drop back below → a fresh crossing re-fires.
	await debitWallet({ ...sub, amount: 120n, idempotencyKey: 'lb-d1' }, emu); // 30
	await run();
	assert.equal(lowCount(), 2, 're-fires after recovery + a fresh crossing');
	assert.equal(noticeCount(), 2);
});

test('withBilling: no low-balance signal when the plan sets no threshold', async () => {
	const { EVENT_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { creditWallet } = await import('../services/wallet');
	const { withBilling } = await import('../middlewares/billing');
	const { MemoryCounterBackend } = await import('../backends/memory');

	const emu = walletEmulator();
	const store = billingStore(emu);
	const uid = '5c3d1e00-0000-4000-8000-000000000def';
	const config = {
		...planWalletConfig([{ name: 'nolow', wallet: { rates: { task: { cost: 5n } } } }]),
		resolveRecipient: () => ({ email: 'z@z.com' }),
	} as IBillingConfig;
	const { bus, calls } = recordingBus();
	const mw = withBilling(store, config, new MemoryCounterBackend(), bus);
	await creditWallet(
		{ subscriberType: 'user', subscriberId: uid, currency: 'USD', amount: 1n, idempotencyKey: 'nl-1' },
		emu,
	);
	await mw(makeCtx({ user: { id: uid, email: 'z@z.com' } }), async () => new Response());
	assert.equal(calls.filter((c) => c.type === EVENT_KEYS.walletLowBalance).length, 0);
	assert.equal(calls.filter((c) => c.type === NOTIFICATION_EVENT).length, 0);
});

// ── production readiness: a receipt path is mandatory when taking money ──

test('collectBillingReadinessProblems: silent when no payments are enabled', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	const noPay = { provider: {}, plans: [{ name: 'free' }], successUrl: 'x', cancelUrl: 'y' } as IBillingConfig;
	assert.deepEqual(collectBillingReadinessProblems(noPay, false), []);
	assert.deepEqual(collectBillingReadinessProblems(noPay, true), []);
});

test('collectBillingReadinessProblems: clean when payments + bus + resolver are all wired', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	const config = { ...walletConfig(), resolveRecipient: () => ({ email: 'a@b.com' }) } as IBillingConfig;
	assert.deepEqual(collectBillingReadinessProblems(config, true), []);
});

test('collectBillingReadinessProblems: flags a missing bus or resolver when payments are enabled', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	// Wallet enables payments; a paid plan does too.
	const walletOnly = walletConfig();
	const paidPlan = {
		provider: {},
		plans: [{ name: 'pro', monthly: { priceId: 'price_x' } }],
		successUrl: 'x',
		cancelUrl: 'y',
	} as IBillingConfig;

	// No bus.
	assert.equal(collectBillingReadinessProblems(walletOnly, false).length, 1);
	// Bus but no resolver.
	assert.equal(collectBillingReadinessProblems(walletOnly, true).length, 1);
	// A paid subscription plan is a payment path too.
	assert.equal(collectBillingReadinessProblems(paidPlan, false).length, 1);
	const problem = collectBillingReadinessProblems(walletOnly, false)[0]!;
	assert.equal(problem.module, '@fonderie/billing');
});

test('collectBillingReadinessProblems: error in production, warning elsewhere', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	const config = walletConfig(); // payments on, no receipt path
	const prev = process.env['NODE_ENV'];
	try {
		process.env['NODE_ENV'] = 'production';
		assert.equal(collectBillingReadinessProblems(config, false)[0]!.severity, 'error');
		process.env['NODE_ENV'] = 'development';
		assert.equal(collectBillingReadinessProblems(config, false)[0]!.severity, 'warning');
	} finally {
		if (prev === undefined) delete process.env['NODE_ENV'];
		else process.env['NODE_ENV'] = prev;
	}
});

test('BillingModule.checkReadiness: surfaces the missing receipt path (no bus)', async () => {
	const { BillingModule } = await import('../module');
	const store = walletEmulator();
	const mod = new BillingModule(store, walletConfig());
	const problems = mod.checkReadiness();
	assert.equal(problems.length, 1);
	assert.equal(problems[0]!.module, '@fonderie/billing');
});

test('BillingModule.checkReadiness: clean with a bus + resolver wired', async () => {
	const { BillingModule } = await import('../module');
	const { EventBus, MemoryTransport } = await import('@fonderie/events');
	const store = walletEmulator();
	const config = { ...walletConfig(), resolveRecipient: () => ({ email: 'a@b.com' }) } as IBillingConfig;
	const mod = new BillingModule(store, config, new EventBus(new MemoryTransport()));
	assert.deepEqual(mod.checkReadiness(), []);
});

// ── Phase 3: refund/chargeback clawback (the §C value-leak fix) ────

// Pure provider normalizers, tested the way normalizePaymentSession is.
test('normalizeChargeRefund: picks the newest refund (Stripe lists most-recent-first)', async () => {
	const { normalizeChargeRefund } = await import('../providers/stripe');
	// Stripe orders refunds.data most-recent-first, so data[0] is the refund
	// this event announces. re_2 is the newer one.
	const r = normalizeChargeRefund({
		id: 'ch_1',
		payment_intent: 'pi_1',
		currency: 'usd',
		amount_refunded: 499, // cumulative — deliberately NOT what we key on
		refunds: { data: [{ id: 're_2', amount: 299, reason: null }, { id: 're_1', amount: 200, reason: 'requested_by_customer' }] },
	} as any);
	assert.equal(r.kind, 'refund');
	assert.equal(r.id, 're_2'); // newest, not the oldest
	assert.equal(r.amount, 299n); // the per-event delta, not the cumulative 499
	assert.equal(r.providerTxId, 'pi_1');
	assert.equal(r.chargeId, 'ch_1');
	assert.equal(r.currency, 'usd');
	assert.equal(r.status, null);
	// Expanded payment_intent object and an empty refunds list are both tolerated.
	const r2 = normalizeChargeRefund({ id: 'ch_2', payment_intent: { id: 'pi_2' }, amount_refunded: 100 } as any);
	assert.equal(r2.providerTxId, 'pi_2');
	assert.equal(r2.id, 'ch_2'); // falls back to charge id when no refund entries
	assert.equal(r2.amount, 100n);
});

test('two sequential charge.refunded payloads (real normalizer) each claw a distinct refund', async () => {
	// Regression guard: Stripe re-sends the FULL cumulative refunds list on each
	// charge.refunded, newest-first. Picking the wrong entry would collide the
	// idempotency key and silently drop every refund after the first (the leak).
	const { normalizeChargeRefund } = await import('../providers/stripe');
	const store = walletEmulator();
	await buyPack(store); // 5000 credits, amountPaid 499, pi_1

	// First $2.00 refund: list has only re_1.
	const first = normalizeChargeRefund({
		id: 'ch_1',
		payment_intent: 'pi_1',
		currency: 'usd',
		amount_refunded: 200,
		refunds: { data: [{ id: 're_1', amount: 200, reason: null }] },
	} as any);
	await handleReversalEvent(store, { type: 'charge.refunded', subscription: null, reversal: first });

	// Second $2.99 refund: Stripe re-delivers the cumulative list, newest-first.
	const second = normalizeChargeRefund({
		id: 'ch_1',
		payment_intent: 'pi_1',
		currency: 'usd',
		amount_refunded: 499,
		refunds: { data: [{ id: 're_2', amount: 299, reason: null }, { id: 're_1', amount: 200, reason: null }] },
	} as any);
	await handleReversalEvent(store, { type: 'charge.refunded', subscription: null, reversal: second });

	// Both partials clawed: 5000*200/499 + 5000*299/499 = 2004 + 2995 = 4999.
	assert.equal(balOf(store), 5000n - 2004n - 2995n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 2);
});

test('normalizeDispute: carries id, amount, status, and both charge + PaymentIntent refs', async () => {
	const { normalizeDispute } = await import('../providers/stripe');
	const d = normalizeDispute({
		id: 'dp_1',
		charge: 'ch_1',
		payment_intent: 'pi_1',
		amount: 499,
		currency: 'usd',
		reason: 'fraudulent',
		status: 'needs_response',
	} as any);
	assert.equal(d.kind, 'dispute');
	assert.equal(d.id, 'dp_1');
	assert.equal(d.providerTxId, 'pi_1');
	assert.equal(d.chargeId, 'ch_1');
	assert.equal(d.amount, 499n);
	assert.equal(d.status, 'needs_response');
	assert.equal(d.reason, 'fraudulent');
});

// A synthetic reversal IBillingEvent the stubbed provider.constructEvent returns.
function refundEvent(over: Record<string, unknown> = {}, type = 'charge.refunded') {
	return {
		type,
		subscription: null,
		reversal: {
			kind: 'refund',
			id: 're_1',
			providerTxId: 'pi_1',
			chargeId: 'ch_1',
			amount: 499n,
			currency: 'usd',
			reason: null,
			status: null,
			metadata: {},
			...over,
		},
	};
}

// Run the purchase webhook once → credits 5000 to USER in USD, provider_tx_id pi_1.
async function buyPack(store: IStoreAdapter): Promise<void> {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	await paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta))).handle(webhookCtx());
}

async function handleReversalEvent(
	store: IStoreAdapter,
	event: unknown,
	bus?: ReturnType<typeof recordingBus>['bus'],
	over: Partial<IBillingConfig> = {},
) {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const cfg = { ...webhookConfig(event), ...over } as IBillingConfig;
	return paymentWebhookController(store, cfg, bus).handle(webhookCtx());
}

function balOf(store: ReturnType<typeof walletEmulator>): bigint {
	return store.state.balances.get(`user|${USER.subscriberId}|USD`)?.amount ?? 0n;
}

test('refund clawback: a full refund reverses the granted credits', async () => {
	const store = walletEmulator();
	await buyPack(store);
	assert.equal(balOf(store), 5000n);
	await handleReversalEvent(store, refundEvent()); // amount 499 == amountPaid → full
	assert.equal(balOf(store), 0n);
	const last = store.state.ledger.at(-1)!;
	assert.equal(last.type, 'refund');
	assert.equal(last.amount, -5000n);
	assert.equal(last.providerTxId, 'pi_1');
});

test('refund clawback: buy → spend → full refund drives the balance NEGATIVE (leak closed)', async () => {
	const { debitWallet } = await import('../services/wallet');
	const store = walletEmulator();
	await buyPack(store);
	await debitWallet({ ...USER, amount: 3000n, type: 'usage', idempotencyKey: 'spend-1' }, store); // 2000
	assert.equal(balOf(store), 2000n);
	await handleReversalEvent(store, refundEvent()); // reverse full 5000
	assert.equal(balOf(store), -3000n, 'the refunded buyer no longer keeps 2000 free credits');
});

test('refund clawback: a partial refund reverses a proportional share of the credits', async () => {
	const store = walletEmulator();
	await buyPack(store);
	// $2.50 of a $4.99 charge → 5000 * 250 / 499 = 2505 credits (bigint floor).
	await handleReversalEvent(store, refundEvent({ amount: 250n }));
	assert.equal(balOf(store), 5000n - 2505n);
});

test('refund clawback: a replayed refund event is idempotent on the refund id (no double clawback)', async () => {
	const store = walletEmulator();
	await buyPack(store);
	// Partial, so the replay reaches the ledger idempotency guard (a FULL-refund
	// replay would instead short-circuit at the cumulative cap — covered below).
	const first = await handleReversalEvent(store, refundEvent({ amount: 250n }));
	assert.equal(((await first.json()) as any).duplicate, false);
	const balAfterFirst = balOf(store);
	const replay = await handleReversalEvent(store, refundEvent({ amount: 250n }));
	assert.equal(((await replay.json()) as any).duplicate, true);
	assert.equal(balOf(store), balAfterFirst, 'balance unchanged on replay');
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 1);
});

test('refund clawback: two distinct partial refunds each apply', async () => {
	const store = walletEmulator();
	await buyPack(store);
	await handleReversalEvent(store, refundEvent({ id: 're_a', amount: 250n })); // 2505
	await handleReversalEvent(store, refundEvent({ id: 're_b', amount: 249n })); // 2494
	assert.equal(balOf(store), 5000n - 2505n - 2494n); // == 1
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 2);
});

test('refund clawback: cumulative reversals are capped at the credits granted', async () => {
	const store = walletEmulator();
	await buyPack(store);
	await handleReversalEvent(store, refundEvent({ id: 're_a' })); // full → 5000, balance 0
	const second = await handleReversalEvent(store, refundEvent({ id: 're_b' })); // nothing left to reverse
	assert.equal(((await second.json()) as any).reversed, '0');
	assert.equal(balOf(store), 0n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 1);
});

test('chargeback: a dispute claws back the remaining credits', async () => {
	const store = walletEmulator();
	await buyPack(store);
	await handleReversalEvent(
		store,
		refundEvent({ kind: 'dispute', id: 'dp_1', amount: 499n, status: 'needs_response' }, 'charge.dispute.created'),
		undefined,
	);
	assert.equal(balOf(store), 0n);
	const last = store.state.ledger.at(-1)!;
	assert.equal(last.type, 'refund');
	assert.equal(last.amount, -5000n);
});

test('chargeback: a dispute won restores exactly what the chargeback clawed', async () => {
	const store = walletEmulator();
	await buyPack(store);
	await handleReversalEvent(
		store,
		refundEvent({ kind: 'dispute', id: 'dp_1', amount: 499n, status: 'needs_response' }, 'charge.dispute.created'),
	);
	assert.equal(balOf(store), 0n);
	await handleReversalEvent(
		store,
		refundEvent({ kind: 'dispute', id: 'dp_1', amount: 499n, status: 'won' }, 'charge.dispute.closed'),
	);
	assert.equal(balOf(store), 5000n, 'won dispute → credits restored');
});

test('chargeback: a dispute lost after it was opened does not double-claw', async () => {
	const store = walletEmulator();
	await buyPack(store);
	await handleReversalEvent(
		store,
		refundEvent({ kind: 'dispute', id: 'dp_1', amount: 499n, status: 'needs_response' }, 'charge.dispute.created'),
	);
	await handleReversalEvent(
		store,
		refundEvent({ kind: 'dispute', id: 'dp_1', amount: 499n, status: 'lost' }, 'charge.dispute.closed'),
	);
	assert.equal(balOf(store), 0n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 1);
});

test('reversal: no matching purchase is acknowledged and touches no wallet', async () => {
	const store = walletEmulator();
	await buyPack(store);
	const res = await handleReversalEvent(store, refundEvent({ providerTxId: 'pi_UNKNOWN' }));
	assert.equal(((await res.json()) as any).ignored, 'no-matching-purchase');
	assert.equal(balOf(store), 5000n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 0);
});

test('reversal: a refund with no provider tx id is acknowledged and ignored', async () => {
	const store = walletEmulator();
	await buyPack(store);
	const res = await handleReversalEvent(store, refundEvent({ providerTxId: null }));
	assert.equal(((await res.json()) as any).ignored, 'no-provider-tx-id');
	assert.equal(balOf(store), 5000n);
});

test('reversal: a refund that prorates to zero credits is a no-op', async () => {
	const store = walletEmulator();
	await buyPack(store);
	const res = await handleReversalEvent(store, refundEvent({ amount: 0n }));
	assert.equal(((await res.json()) as any).reversed, '0');
	assert.equal(balOf(store), 5000n);
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 0);
});

test('reversal: a known partial amount with no proration basis refuses to over-claw', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	// Purchase whose amount_total was null → metadata.amountPaid stored null,
	// so a partial refund has no denominator to prorate against.
	await paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta, { amountTotal: null }))).handle(webhookCtx());
	assert.equal(balOf(store), 5000n);
	const res = await handleReversalEvent(store, refundEvent({ amount: 250n }));
	assert.equal(((await res.json()) as any).ignored, 'no-proration-basis');
	assert.equal(balOf(store), 5000n, 'a partial refund must not claw the whole balance');
	assert.equal(store.state.ledger.filter((l) => l.type === 'refund').length, 0);
});

test('reversal: emits payment.refunded + wallet.debited and a refund-processed notice, once', async () => {
	const { EVENT_KEYS, MESSAGE_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const store = walletEmulator();
	await buyPack(store); // no bus — purchase events irrelevant here
	const { bus, calls } = recordingBus();
	await handleReversalEvent(store, refundEvent(), bus, { resolveRecipient: () => ({ email: 'b@x.com' }) });
	assert.equal(calls.filter((c) => c.type === EVENT_KEYS.paymentRefunded).length, 1);
	const debited = calls.filter((c) => c.type === EVENT_KEYS.walletDebited);
	assert.equal(debited.length, 1);
	assert.equal(debited[0]!.payload.credits, '5000');
	assert.equal(debited[0]!.payload.source, 'refund');
	const notices = calls.filter((c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.refundProcessed);
	assert.equal(notices.length, 1);
	assert.equal(notices[0]!.payload.recipient.email, 'b@x.com');
	// Replay → duplicate → no re-emit, no re-notify.
	const replay = recordingBus();
	await handleReversalEvent(store, refundEvent(), replay.bus, { resolveRecipient: () => ({ email: 'b@x.com' }) });
	assert.equal(replay.calls.length, 0);
});

test('subscription status: an unpaid subscription is treated as inactive (no new grant)', async () => {
	const { withBilling } = await import('../middlewares/billing');
	const { MemoryCounterBackend } = await import('../backends/memory');
	const emu = walletEmulator();
	const store = billingStore(emu, { plan: 'free', status: 'unpaid' });
	const config = planWalletConfig([FREE_PLAN]);
	const mw = withBilling(store, config, new MemoryCounterBackend());
	let nextCalled = false;
	await mw(makeCtx({}), async () => {
		nextCalled = true;
		return new Response();
	});
	assert.equal(nextCalled, true);
	assert.equal(emu.state.ledger.filter((l) => l.type === 'grant').length, 0, 'unpaid → no periodic grant');
});

// ── auto-recharge: off-session top-up at a threshold ──────────────

const AR_PACK = { id: 'refill', name: 'Refill', credits: 1000n, priceAmount: 500n };

function rechargeProvider(over: Record<string, unknown> = {}) {
	const calls: { charge?: any } = {};
	const provider = {
		name: 'stub',
		async chargeOffSession(opts: unknown) {
			calls.charge = opts;
			return { providerTxId: 'pi_ar_1', status: 'succeeded' as const };
		},
		...over,
	};
	return { provider: provider as unknown as IBillingConfig['provider'], calls };
}

function autoRechargeConfig(
	autoOver: Record<string, unknown> = {},
	providerOver: Record<string, unknown> = {},
): IBillingConfig {
	const { provider } = rechargeProvider(providerOver);
	const plan = { name: 'metered', wallet: { autoRecharge: { threshold: 100n, packId: 'refill', ...autoOver } } };
	return {
		...walletConfig({ creditPacks: [AR_PACK] }),
		plans: [plan],
		provider,
	} as IBillingConfig;
}

async function armCustomer(store: IStoreAdapter, providerCustomerId = 'cus_1'): Promise<void> {
	const { upsertWalletCustomer } = await import('../services/wallet-customers');
	await upsertWalletCustomer(
		{ subscriberType: 'user', subscriberId: USER.subscriberId, provider: 'stub', providerCustomerId, rearm: true },
		store,
	);
}

// The cooldown is floored at 1s, so sequential test attempts clear the last
// attempt time to simulate the window having elapsed (rather than sleeping).
function elapseCooldown(store: ReturnType<typeof walletEmulator>): void {
	const row = store.state.customers.get(`user|${USER.subscriberId}|stub`);
	if (row) row.lastRechargeAt = null;
}

async function runRecharge(store: IStoreAdapter, config: IBillingConfig, balance: bigint, bus?: any): Promise<void> {
	const { maybeAutoRecharge } = await import('../services/auto-recharge');
	const { resolvePlanWallet } = await import('../services/wallet');
	const planWallet = resolvePlanWallet(config.plans[0] as any, config)!;
	await maybeAutoRecharge({
		store,
		config,
		bus,
		subscriberType: 'user',
		subscriberId: USER.subscriberId,
		balance,
		planWallet,
	});
}

const arBal = (store: ReturnType<typeof walletEmulator>): bigint =>
	store.state.balances.get(`user|${USER.subscriberId}|USD`)?.amount ?? 0n;

test('auto-recharge: below threshold with a card on file charges the pack and credits its credits', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	const config = autoRechargeConfig();
	await runRecharge(store, config, 50n);
	assert.equal(arBal(store), 1000n);
	const row = store.state.ledger.at(-1)!;
	assert.equal(row.type, 'purchase');
	assert.equal(row.amount, 1000n);
	assert.equal(row.providerTxId, 'pi_ar_1');
	assert.equal(row.idempotencyKey, 'stub:autorecharge:pi_ar_1');
});

test('auto-recharge: above threshold does nothing', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	await runRecharge(store, autoRechargeConfig(), 200n);
	assert.equal(arBal(store), 0n);
	assert.equal(store.state.ledger.length, 0);
});

test('auto-recharge: no card on file does nothing', async () => {
	const store = walletEmulator();
	await runRecharge(store, autoRechargeConfig(), 50n); // never armed
	assert.equal(arBal(store), 0n);
});

test('auto-recharge: no chargeOffSession on the provider is a no-op', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	// provider without chargeOffSession
	const config = autoRechargeConfig({}, { chargeOffSession: undefined });
	await runRecharge(store, config, 50n);
	assert.equal(arBal(store), 0n);
});

test('auto-recharge: the cooldown allows only one charge per window', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	const config = autoRechargeConfig({ cooldownSeconds: 3600 });
	await runRecharge(store, config, 50n);
	await runRecharge(store, config, 50n); // still low, but within cooldown
	assert.equal(arBal(store), 1000n, 'charged once');
	assert.equal(store.state.ledger.filter((l) => l.type === 'purchase').length, 1);
});

test('auto-recharge: a duplicate provider tx id never double-credits', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	// provider returns the SAME pi both times; elapse the cooldown between them.
	const config = autoRechargeConfig();
	await runRecharge(store, config, 50n);
	elapseCooldown(store);
	await runRecharge(store, config, 50n);
	assert.equal(arBal(store), 1000n, 'idempotent on the charge id');
	assert.equal(store.state.ledger.filter((l) => l.type === 'purchase').length, 1);
});

test('auto-recharge: a declined card records a failure and does not credit', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	const { EVENT_KEYS, MESSAGE_KEYS } = await import('../config');
	const { NOTIFICATION_EVENT } = await import('@fonderie/events');
	const { bus, calls } = recordingBus();
	const config = {
		...autoRechargeConfig({}, { chargeOffSession: async () => ({ providerTxId: null, status: 'failed' as const }) }),
		resolveRecipient: () => ({ email: 'z@z.com' }),
	} as IBillingConfig;
	await runRecharge(store, config, 50n, bus);
	assert.equal(arBal(store), 0n, 'no credit on decline');
	assert.equal(calls.filter((c) => c.type === EVENT_KEYS.autoRechargeFailed).length, 1);
	assert.equal(
		calls.filter((c) => c.type === NOTIFICATION_EVENT && c.payload.type === MESSAGE_KEYS.autoRechargeFailed).length,
		1,
	);
});

test('auto-recharge: disables after N consecutive failures, then stops attempting', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	let charges = 0;
	const config = autoRechargeConfig(
		{ maxConsecutiveFailures: 2 },
		{
			chargeOffSession: async () => {
				charges++;
				return { providerTxId: null, status: 'failed' as const };
			},
		},
	);
	await runRecharge(store, config, 50n); // fail 1
	elapseCooldown(store);
	await runRecharge(store, config, 50n); // fail 2 → disabled
	elapseCooldown(store);
	await runRecharge(store, config, 50n); // disabled → claim returns null, no charge
	assert.equal(charges, 2, 'stops charging once disabled');
	assert.equal(store.state.customers.get(`user|${USER.subscriberId}|stub`)!.disabled, true);
});

test('auto-recharge: a successful charge resets the failure counter', async () => {
	const { recordRechargeFailure, recordRechargeSuccess, claimAutoRecharge } = await import(
		'../services/wallet-customers'
	);
	const store = walletEmulator();
	await armCustomer(store);
	const key = { subscriberType: 'user' as SubscriberType, subscriberId: USER.subscriberId, provider: 'stub' };
	await recordRechargeFailure({ ...key, maxConsecutiveFailures: 5 }, store);
	assert.equal(store.state.customers.get(`user|${USER.subscriberId}|stub`)!.failures, 1);
	await recordRechargeSuccess(key, store);
	assert.equal(store.state.customers.get(`user|${USER.subscriberId}|stub`)!.failures, 0);
	// claim returns the customer when eligible.
	const claim = await claimAutoRecharge({ ...key, cooldownSeconds: 0 }, store);
	assert.equal(claim?.providerCustomerId, 'cus_1');
});

test('payment webhook: a pack purchase persists the customer (arming auto-recharge)', async () => {
	const store = walletEmulator();
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	await paymentWebhookController(store, webhookConfig(paymentEvent(walletMeta, { customerId: 'cus_42' }))).handle(webhookCtx());
	const row = store.state.customers.get(`user|${USER.subscriberId}|stub`);
	assert.equal(row?.providerCustomerId, 'cus_42');
	assert.equal(row?.disabled, false);
});

test('withBilling: a low balance with auto-recharge armed tops the wallet up', async () => {
	const { withBilling } = await import('../middlewares/billing');
	const { MemoryCounterBackend } = await import('../backends/memory');
	const emu = walletEmulator();
	const store = billingStore(emu);
	await armCustomer(store);
	// Pre-fund below threshold so withBilling sees a low balance.
	const { creditWallet } = await import('../services/wallet');
	await creditWallet({ ...USER, amount: 50n, type: 'grant', idempotencyKey: 'wb-seed' }, store);
	const config = autoRechargeConfig();
	const mw = withBilling(store, config, new MemoryCounterBackend());
	await mw(makeCtx({}), async () => new Response());
	// Auto-recharge is fire-and-forget; let the microtasks settle.
	await new Promise((r) => setTimeout(r, 20));
	assert.equal(arBal(emu), 50n + 1000n, 'withBilling triggered the top-up');
});

test('readiness: auto-recharge without provider chargeOffSession is flagged', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	const config = autoRechargeConfig({}, { chargeOffSession: undefined });
	const problems = collectBillingReadinessProblems(config, true);
	assert.ok(problems.some((p) => p.message.includes('does not implement chargeOffSession')));
});

test('readiness: auto-recharge referencing an unknown pack is flagged', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	const problems = collectBillingReadinessProblems(autoRechargeConfig({ packId: 'nope' }), true);
	assert.ok(problems.some((p) => p.message.includes("unknown credit pack 'nope'")));
});

test('readiness: correctly-wired auto-recharge adds no problems', async () => {
	const { collectBillingReadinessProblems } = await import('../services/notify');
	const config = { ...autoRechargeConfig(), resolveRecipient: () => ({ email: 'a@b.com' }) } as IBillingConfig;
	assert.equal(collectBillingReadinessProblems(config, true).length, 0);
});

test('auto-recharge: a refund of an auto-recharge charge claws back the full credits (amountPaid recorded)', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	await runRecharge(store, autoRechargeConfig(), 50n); // +1000 credits, pi_ar_1, amountPaid 500
	assert.equal(arBal(store), 1000n);
	// A full refund of the auto-recharge charge must reverse all 1000 credits —
	// only possible because the credit row now carries amountPaid to prorate on.
	await handleReversalEvent(store, refundEvent({ providerTxId: 'pi_ar_1', amount: 500n }));
	assert.equal(arBal(store), 0n, 'refund reverses the full auto-recharged credits, not zero');
});

test('auto-recharge: a rearm=false upsert (duplicate webhook) never resurrects a disabled customer', async () => {
	const { upsertWalletCustomer, recordRechargeFailure } = await import('../services/wallet-customers');
	const store = walletEmulator();
	const key = { subscriberType: 'user' as SubscriberType, subscriberId: USER.subscriberId, provider: 'stub' };
	const k = `user|${USER.subscriberId}|stub`;
	await upsertWalletCustomer({ ...key, providerCustomerId: 'cus_1', rearm: true }, store);
	await recordRechargeFailure({ ...key, maxConsecutiveFailures: 1 }, store);
	assert.equal(store.state.customers.get(k)!.disabled, true);
	// Duplicate purchase delivery (rearm=false) must NOT clear the disable.
	await upsertWalletCustomer({ ...key, providerCustomerId: 'cus_1', rearm: false }, store);
	assert.equal(store.state.customers.get(k)!.disabled, true, 'a replay does not re-arm');
	// A genuinely new purchase (rearm=true) re-arms.
	await upsertWalletCustomer({ ...key, providerCustomerId: 'cus_1', rearm: true }, store);
	assert.equal(store.state.customers.get(k)!.disabled, false);
});

test('auto-recharge: an indeterminate charge retries with the SAME key and never double-charges', async () => {
	const store = walletEmulator();
	await armCustomer(store);
	const keys: string[] = [];
	let attempt = 0;
	const config = autoRechargeConfig(
		{},
		{
			chargeOffSession: async (opts: any) => {
				keys.push(opts.idempotencyKey);
				attempt++;
				// 1st: capture lost (unknown). 2nd: the same charge resolves.
				return attempt === 1
					? { providerTxId: null, status: 'unknown' as const }
					: { providerTxId: 'pi_ar_1', status: 'succeeded' as const };
			},
		},
	);
	const k = `user|${USER.subscriberId}|stub`;
	await runRecharge(store, config, 50n); // unknown → no credit, no failure, pending retained
	assert.equal(arBal(store), 0n);
	assert.equal(store.state.customers.get(k)!.failures, 0, 'unknown is not counted as a decline');
	assert.equal(store.state.customers.get(k)!.pendingKey, keys[0], 'pending key retained for reuse');
	elapseCooldown(store);
	await runRecharge(store, config, 50n); // reuses the same key → resolves → credits once
	assert.equal(keys[0], keys[1], 'the same idempotency key is reused so the provider dedupes');
	assert.equal(arBal(store), 1000n, 'credited exactly once after reconciliation');
	assert.equal(store.state.customers.get(k)!.pendingKey, null, 'pending cleared on the definitive outcome');
});

test('auto-recharge: a credit failure AFTER capture keeps the pending key so the retry never double-charges', async () => {
	// Simulate creditWallet throwing a transient DB error the first time (after
	// Stripe already captured): the pending key must remain so the next window
	// reuses it and the provider dedupes to the same PaymentIntent.
	let failNextCredit = true;
	const emu = interceptingEmulator((sql, params) => {
		if (
			failNextCredit &&
			sql.trimStart().startsWith('INSERT') &&
			sql.includes('fonderie_wallet_ledger') &&
			params[3] === 'purchase'
		) {
			failNextCredit = false;
			throw new Error('transient db error');
		}
		return undefined;
	});
	await armCustomer(emu);
	const keys: string[] = [];
	const config = autoRechargeConfig(
		{},
		{
			chargeOffSession: async (opts: any) => {
				keys.push(opts.idempotencyKey);
				return { providerTxId: 'pi_ar_1', status: 'succeeded' as const };
			},
		},
	);
	const k = `user|${USER.subscriberId}|stub`;
	await assert.rejects(runRecharge(emu, config, 50n), /transient db error/);
	assert.equal(emu.state.customers.get(k)!.pendingKey, keys[0], 'pending key retained after credit throw');
	assert.equal(emu.state.balances.get(`user|${USER.subscriberId}|USD`)?.amount ?? 0n, 0n, 'credit rolled back');
	// Next window: same key reused → same PI → credit finally lands.
	elapseCooldown(emu);
	await runRecharge(emu, config, 50n);
	assert.equal(keys[0], keys[1], 'reused the same idempotency key — no second charge');
	assert.equal(emu.state.balances.get(`user|${USER.subscriberId}|USD`)?.amount ?? 0n, 1000n, 'credited once');
	assert.equal(emu.state.customers.get(k)!.pendingKey, null, 'pending cleared only after the credit committed');
});
