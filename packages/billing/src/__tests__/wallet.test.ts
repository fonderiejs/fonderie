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

interface IWalletState {
	balances: Map<string, IBalRow>;
	ledger: ILedgerRow[];
	grants: Map<string, bigint>;
	seq: number;
}

function uniqueViolation(): Error {
	return Object.assign(
		new Error('duplicate key value violates unique constraint "fonderie_wallet_ledger_idempotency_key_key"'),
		{ code: '23505' },
	);
}

function runWalletSql(state: IWalletState, sql: string, params: unknown[] = []): unknown[] {
	const balKey = (st: unknown, sid: unknown, cur: unknown) => `${st}|${sid}|${cur}`;

	if (sql.includes('fonderie_wallet_ledger')) {
		if (sql.includes('idempotency_key = $1')) {
			const row = state.ledger.find((l) => l.idempotencyKey === params[0]);
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

	throw new Error(`walletEmulator: unhandled SQL: ${sql.slice(0, 80)}`);
}

// Serializing emulator: transactions queue on one chain (the row-lock model)
// and roll back to a snapshot on throw.
function walletEmulator(): IStoreAdapter & { state: IWalletState } {
	const state: IWalletState = { balances: new Map(), ledger: [], grants: new Map(), seq: 0 };
	let chain: Promise<unknown> = Promise.resolve();

	const snapshot = (): IWalletState => ({
		balances: new Map([...state.balances].map(([k, v]) => [k, { ...v }])),
		ledger: [...state.ledger],
		grants: new Map(state.grants),
		seq: state.seq,
	});
	const restore = (s: IWalletState) => {
		state.balances = s.balances;
		state.ledger = s.ledger;
		state.grants = s.grants;
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
	const state: IWalletState = { balances: new Map(), ledger: [], grants: new Map(), seq: 0 };
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

test('decodeLedgerCursor: rejects garbage', async () => {
	const { decodeLedgerCursor, encodeLedgerCursor } = await import('../services/wallet');
	assert.equal(decodeLedgerCursor('not-base64-json'), null);
	assert.equal(decodeLedgerCursor(Buffer.from('{"a":1}').toString('base64url')), null);
	assert.equal(decodeLedgerCursor(Buffer.from('["not-a-date","x"]').toString('base64url')), null);
	const round = decodeLedgerCursor(encodeLedgerCursor('2026-09-04T00:00:00.000Z', 'id-1'));
	assert.deepEqual(round, { createdAt: '2026-09-04T00:00:00.000Z', id: 'id-1' });
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

function makeCtx(opts: { url?: string; user?: unknown; body?: unknown; headers?: Record<string, string> } = {}): import('@fonderie/core').IFonderieContext {
	return {
		meta: { body: opts.body ?? {} },
		user: 'user' in opts ? opts.user : { id: USER.subscriberId, email: 'a@b.com' },
		workspace: null,
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
	const ctrl = walletController(walletEmulator(), config);
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
	const ctrl = walletController(walletEmulator(), config);
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
	const ctrl = walletController(walletEmulator(), config);
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

test('payment webhook: falls back to the subscription webhookSecret', async () => {
	const { paymentWebhookController } = await import('../controllers/payment-webhook.controller');
	const store = walletEmulator();
	let seenSecret = '';
	const { provider } = paymentProvider({
		constructEvent: async (opts: { secret: string }) => {
			seenSecret = opts.secret;
			return paymentEvent(walletMeta);
		},
	});
	const config = {
		...walletConfig({ creditPacks: PACKS }),
		webhookSecret: 'whsec_subscription',
		provider,
	} as IBillingConfig;
	const res = await paymentWebhookController(store, config).handle(webhookCtx());
	assert.equal(res.status, 200);
	assert.equal(seenSecret, 'whsec_subscription');
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
		amount_total: 499,
		currency: 'usd',
		metadata: { packId: 'small' },
	});
	assert.deepEqual(full, {
		sessionId: 'cs_1',
		providerTxId: 'pi_9',
		amountTotal: 499n,
		currency: 'usd',
		metadata: { packId: 'small' },
	});

	const expanded = normalizePaymentSession({ id: 'cs_2', payment_intent: { id: 'pi_x' } });
	assert.equal(expanded.providerTxId, 'pi_x');

	const bare = normalizePaymentSession({ id: 'cs_3' });
	assert.equal(bare.providerTxId, null);
	assert.equal(bare.amountTotal, null);
	assert.equal(bare.currency, null);
	assert.deepEqual(bare.metadata, {});
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
