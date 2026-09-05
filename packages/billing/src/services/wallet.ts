import type { IStoreAdapter } from '@fonderie/store';

import type {
	IWalletBalance,
	IWalletLedgerEntry,
	IWalletRate,
	SubscriberType,
	WalletLedgerType,
} from '../types';
import type { IBillingConfig, IBillingPlan } from '../config';
import { DuplicateTransactionError, InsufficientFundsError } from '../errors';
import { normalizeCurrency } from '../utils';

// The ledger is the source of truth; fonderie_wallet_balances is a cache that
// is NEVER written without a ledger row in the same transaction. Every
// mutation carries an idempotency key backed by the ledger's UNIQUE
// constraint, so a replayed request re-reads instead of re-applying: the
// pre-check catches replays cheaply, and a lost race between two identical
// replays still resolves safely — the second ledger INSERT violates the
// constraint and rolls its balance write back with it.
//
// CONTRACT: pass the module-level store, never a tx-scoped adapter from an
// enclosing store.transaction. The wallet manages its own transaction; the
// pg adapter flattens nested transactions WITHOUT savepoints, so inside a
// caller's transaction the rollback-on-conflict guarantee above would not
// hold (and a conflict would poison the caller's whole transaction).

export interface IWalletSubscriber {
	subscriberType: SubscriberType;
	subscriberId: string;
	currency: string;
}

export interface IWalletMutationResult {
	balance: bigint;
	// True when the idempotency key had already been applied — the wallet was
	// left untouched and `balance` is the current value.
	duplicate: boolean;
}

interface ILedgerKeyRow {
	subscriberType: SubscriberType;
	subscriberId: string;
	currency: string;
}

interface IBalanceRow {
	amount: string;
	version: string;
	updatedAt: string | Date | null;
}

const UNIQUE_VIOLATION = '23505';

// Only the ledger's idempotency-key UNIQUE violation counts as a safe
// replay. Anything else (NOT NULL violations, other constraints) must
// surface as the error it is — a loose message match here once turned a
// rolled-back failure into a fake duplicate-success.
function isIdempotencyConflict(err: unknown): boolean {
	const e = err as { code?: string; constraint?: string; message?: string };
	if (e?.code !== UNIQUE_VIOLATION) return false;
	if (typeof e.constraint === 'string') return e.constraint.includes('idempotency_key');
	return typeof e.message === 'string' && e.message.includes('idempotency_key');
}

// Returns the existing ledger row for the key, or null. Throws when the key
// exists but belongs to a different subscriber/currency — key reuse across
// scopes is a caller bug, not a safe replay.
async function findByIdempotencyKey(
	sub: IWalletSubscriber,
	idempotencyKey: string,
	store: IStoreAdapter,
): Promise<ILedgerKeyRow | null> {
	const [row] = await store.query<ILedgerKeyRow>(
		`SELECT
			subscriber_type AS "subscriberType",
			subscriber_id   AS "subscriberId",
			currency
		FROM fonderie_wallet_ledger
		WHERE idempotency_key = $1`,
		[idempotencyKey],
	);
	if (!row) return null;
	if (
		row.subscriberType !== sub.subscriberType ||
		row.subscriberId !== sub.subscriberId ||
		row.currency !== sub.currency
	) {
		throw new DuplicateTransactionError(idempotencyKey);
	}
	return row;
}

async function readBalance(sub: IWalletSubscriber, store: IStoreAdapter): Promise<bigint> {
	const [row] = await store.query<{ amount: string }>(
		`SELECT amount FROM fonderie_wallet_balances
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
		[sub.subscriberType, sub.subscriberId, sub.currency],
	);
	return BigInt(row?.amount ?? '0');
}

// Atomic upsert-add on the balance cache. tx-scoped: callers pair it with a
// ledger row in the same transaction, never alone.
async function applyBalanceCredit(
	tx: IStoreAdapter,
	sub: IWalletSubscriber,
	amount: bigint,
): Promise<bigint> {
	const [row] = await tx.query<{ amount: string }>(
		`INSERT INTO fonderie_wallet_balances (subscriber_type, subscriber_id, currency, amount)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (subscriber_type, subscriber_id, currency) DO UPDATE SET
			amount     = fonderie_wallet_balances.amount + EXCLUDED.amount,
			version    = fonderie_wallet_balances.version + 1,
			updated_at = now()
		RETURNING amount`,
		[sub.subscriberType, sub.subscriberId, sub.currency, amount.toString()],
	);
	return BigInt(row?.amount ?? '0');
}

async function insertLedgerRow(
	tx: IStoreAdapter,
	sub: IWalletSubscriber,
	opts: {
		type: WalletLedgerType;
		amount: bigint; // signed
		balanceAfter: bigint;
		idempotencyKey: string;
		description: string | null;
		metadata: Record<string, unknown>;
		providerTxId: string | null;
	},
): Promise<void> {
	await tx.query(
		`INSERT INTO fonderie_wallet_ledger
			(subscriber_type, subscriber_id, currency, type, amount, balance_after,
			 description, idempotency_key, metadata, provider_tx_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
		[
			sub.subscriberType,
			sub.subscriberId,
			sub.currency,
			opts.type,
			opts.amount.toString(),
			opts.balanceAfter.toString(),
			opts.description,
			opts.idempotencyKey,
			JSON.stringify(opts.metadata),
			opts.providerTxId,
		],
	);
}

// Add credits. Idempotent: a replayed key returns the current balance with
// duplicate: true. The balance upsert-add is a single atomic statement, so
// credits need no row lock; the same-transaction ledger row (with its UNIQUE
// key) is what makes a concurrent identical replay roll back cleanly.
// Pass the module-level store — never a tx-scoped adapter (see file header).
export async function creditWallet(
	opts: IWalletSubscriber & {
		amount: bigint; // positive
		idempotencyKey: string;
		type?: WalletLedgerType;
		description?: string;
		metadata?: Record<string, unknown>;
		providerTxId?: string;
	},
	store: IStoreAdapter,
): Promise<IWalletMutationResult> {
	if (opts.amount < 0n) throw new Error('[billing:wallet] credit amount must be positive');
	if (!opts.idempotencyKey) throw new Error('[billing:wallet] idempotencyKey is required');
	if (opts.amount === 0n) {
		return { balance: await readBalance(opts, store), duplicate: false };
	}

	try {
		return await store.transaction(async (tx) => {
			const existing = await findByIdempotencyKey(opts, opts.idempotencyKey, tx);
			if (existing) return { balance: await readBalance(opts, tx), duplicate: true };

			const balance = await applyBalanceCredit(tx, opts, opts.amount);

			await insertLedgerRow(tx, opts, {
				type: opts.type ?? 'adjustment',
				amount: opts.amount,
				balanceAfter: balance,
				idempotencyKey: opts.idempotencyKey,
				description: opts.description ?? null,
				metadata: opts.metadata ?? {},
				providerTxId: opts.providerTxId ?? null,
			});

			return { balance, duplicate: false };
		});
	} catch (err) {
		// Lost a race against an identical replay: its ledger row landed first,
		// ours violated the UNIQUE key and the whole transaction rolled back.
		if (isIdempotencyConflict(err)) {
			return { balance: await readBalance(opts, store), duplicate: true };
		}
		throw err;
	}
}

// Atomically deduct credits. Two independent guarantees prevent double-spend:
// the SELECT ... FOR UPDATE serializes concurrent debits for one subscriber,
// and the conditional UPDATE (amount - cost >= floor) re-checks the floor in
// the same statement — so even a backend without row locks cannot go below
// the overdraft floor. Throws InsufficientFundsError past the floor.
// Pass the module-level store — never a tx-scoped adapter (see file header).
export async function debitWallet(
	opts: IWalletSubscriber & {
		amount: bigint; // positive; recorded as negative in the ledger
		idempotencyKey: string;
		type?: WalletLedgerType;
		overdraftLimit?: bigint; // >= 0; how far below zero the balance may go
		description?: string;
		metadata?: Record<string, unknown>;
	},
	store: IStoreAdapter,
): Promise<IWalletMutationResult> {
	if (opts.amount < 0n) throw new Error('[billing:wallet] debit amount must be positive');
	if (!opts.idempotencyKey) throw new Error('[billing:wallet] idempotencyKey is required');
	if (opts.amount === 0n) {
		// Zero-cost debit (e.g. unlimited plan rate) — no ledger row, no-op.
		return { balance: await readBalance(opts, store), duplicate: false };
	}
	const floor = -(opts.overdraftLimit ?? 0n);

	try {
		return await store.transaction(async (tx) => {
			const existing = await findByIdempotencyKey(opts, opts.idempotencyKey, tx);
			if (existing) return { balance: await readBalance(opts, tx), duplicate: true };

			// Make sure the row exists so FOR UPDATE has something to lock, then
			// lock it — concurrent debits for this subscriber serialize here.
			await tx.query(
				`INSERT INTO fonderie_wallet_balances (subscriber_type, subscriber_id, currency, amount)
				VALUES ($1, $2, $3, 0)
				ON CONFLICT (subscriber_type, subscriber_id, currency) DO NOTHING`,
				[opts.subscriberType, opts.subscriberId, opts.currency],
			);
			const [locked] = await tx.query<{ amount: string }>(
				`SELECT amount FROM fonderie_wallet_balances
				WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3
				FOR UPDATE`,
				[opts.subscriberType, opts.subscriberId, opts.currency],
			);
			const current = BigInt(locked?.amount ?? '0');

			if (current - opts.amount < floor) {
				throw new InsufficientFundsError(current, opts.amount, opts.currency);
			}

			const [updated] = await tx.query<{ amount: string }>(
				`UPDATE fonderie_wallet_balances
				SET amount = amount - $4, version = version + 1, updated_at = now()
				WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3
					AND amount - $4 >= $5
				RETURNING amount`,
				[
					opts.subscriberType,
					opts.subscriberId,
					opts.currency,
					opts.amount.toString(),
					floor.toString(),
				],
			);
			// Belt and braces: with row locking this cannot miss after the check
			// above; without it, this is the statement that holds the floor.
			if (!updated) {
				throw new InsufficientFundsError(current, opts.amount, opts.currency);
			}
			const balance = BigInt(updated.amount);

			await insertLedgerRow(tx, opts, {
				type: opts.type ?? 'usage',
				amount: -opts.amount,
				balanceAfter: balance,
				idempotencyKey: opts.idempotencyKey,
				description: opts.description ?? null,
				metadata: opts.metadata ?? {},
				providerTxId: null,
			});

			return { balance, duplicate: false };
		});
	} catch (err) {
		if (isIdempotencyConflict(err)) {
			return { balance: await readBalance(opts, store), duplicate: true };
		}
		throw err;
	}
}

export async function getWalletBalance(
	sub: IWalletSubscriber,
	store: IStoreAdapter,
): Promise<IWalletBalance> {
	const [row] = await store.query<IBalanceRow>(
		`SELECT amount, version, updated_at AS "updatedAt"
		FROM fonderie_wallet_balances
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
		[sub.subscriberType, sub.subscriberId, sub.currency],
	);
	if (!row) return { balance: 0n, version: 0, updatedAt: null };
	return {
		balance: BigInt(row.amount),
		version: Number(row.version),
		updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
	};
}

export interface IWalletLedgerPage {
	entries: IWalletLedgerEntry[];
	// Opaque cursor for the next (older) page, or null when exhausted.
	nextCursor: string | null;
}

export function encodeLedgerCursor(createdAt: string, id: string): string {
	return Buffer.from(JSON.stringify([createdAt, id])).toString('base64url');
}

// Accepts ISO timestamps and Postgres' own text format (microsecond
// precision, e.g. '2026-09-04 18:50:50.888123+00') — the cursor carries the
// latter to avoid the JS Date millisecond truncation that would skip
// same-millisecond ledger rows between pages.
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;
const CURSOR_ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function decodeLedgerCursor(cursor: string): { createdAt: string; id: string } | null {
	if (cursor.length > 256) return null;
	try {
		const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
		if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') {
			return null;
		}
		// Both halves feed ::timestamptz / ::uuid casts — validate here so a
		// crafted cursor yields a 422, not a Postgres cast error.
		if (!CURSOR_TS_RE.test(parsed[0]) || !CURSOR_ID_RE.test(parsed[1])) return null;
		return { createdAt: parsed[0], id: parsed[1] };
	} catch {
		return null;
	}
}

interface ILedgerRow {
	id: string;
	subscriberType: SubscriberType;
	subscriberId: string;
	currency: string;
	type: WalletLedgerType;
	amount: string;
	balanceAfter: string;
	description: string | null;
	idempotencyKey: string;
	metadata: Record<string, unknown> | null;
	providerTxId: string | null;
	createdAt: string | Date;
	// created_at::text — full microsecond precision for the keyset cursor
	// (node-pg parses timestamptz into a millisecond Date, which would make
	// the cursor skip rows sharing a truncated millisecond).
	createdAtRaw: string;
}

export async function getWalletLedger(
	opts: IWalletSubscriber & {
		limit?: number; // 1..100, default 50
		cursor?: { createdAt: string; id: string };
	},
	store: IStoreAdapter,
): Promise<IWalletLedgerPage> {
	const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

	const params: unknown[] = [opts.subscriberType, opts.subscriberId, opts.currency];
	let cursorClause = '';
	if (opts.cursor) {
		params.push(opts.cursor.createdAt, opts.cursor.id);
		cursorClause = `AND (created_at, id) < ($4::timestamptz, $5::uuid)`;
	}
	params.push(limit + 1);

	const rows = await store.query<ILedgerRow>(
		`SELECT
			id,
			subscriber_type AS "subscriberType",
			subscriber_id   AS "subscriberId",
			currency,
			type,
			amount,
			balance_after   AS "balanceAfter",
			description,
			idempotency_key AS "idempotencyKey",
			metadata,
			provider_tx_id  AS "providerTxId",
			created_at      AS "createdAt",
			created_at::text AS "createdAtRaw"
		FROM fonderie_wallet_ledger
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3
			${cursorClause}
		ORDER BY created_at DESC, id DESC
		LIMIT $${params.length}`,
		params,
	);

	const page = rows.slice(0, limit);
	const entries: IWalletLedgerEntry[] = page.map((r) => ({
		id: r.id,
		subscriberType: r.subscriberType,
		subscriberId: r.subscriberId,
		currency: r.currency,
		type: r.type,
		amount: BigInt(r.amount),
		balanceAfter: BigInt(r.balanceAfter),
		description: r.description,
		idempotencyKey: r.idempotencyKey,
		metadata: r.metadata ?? {},
		providerTxId: r.providerTxId,
		createdAt: new Date(r.createdAt).toISOString(),
	}));

	const lastRow = page[page.length - 1];
	const nextCursor =
		rows.length > limit && lastRow ? encodeLedgerCursor(lastRow.createdAtRaw, lastRow.id) : null;
	return { entries, nextCursor };
}

// A plan's wallet economics with every default applied. Null when the wallet
// subsystem is off (no config.wallet) or the plan defines no wallet.
export interface IResolvedPlanWallet {
	currency: string;
	precision: number;
	overdraftLimit: bigint;
	grantAmount: bigint | null;
	grantPeriod: 'month' | 'week' | 'day';
	rates: Record<string, IWalletRate>;
}

export function resolvePlanWallet(
	plan: IBillingPlan,
	config: IBillingConfig,
): IResolvedPlanWallet | null {
	if (!config.wallet || !plan.wallet) return null;
	return {
		currency: normalizeCurrency(plan.wallet.currency ?? config.wallet.currency ?? 'USD'),
		precision: plan.wallet.precision ?? config.wallet.precision ?? 2,
		overdraftLimit: plan.wallet.overdraftLimit ?? 0n,
		grantAmount: plan.wallet.grantAmount ?? null,
		grantPeriod: plan.wallet.grantPeriod ?? 'month',
		rates: plan.wallet.rates ?? {},
	};
}

// UTC period key for periodic grants: '2026-09' (month), '2026-09-04' (day),
// '2026-W36' (ISO week — note the ISO week-numbering year at boundaries).
export function currentGrantPeriod(period: 'month' | 'week' | 'day', now = new Date()): string {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	if (period === 'month') return `${y}-${m}`;
	if (period === 'day') return `${y}-${m}-${d}`;
	// ISO week: shift to the Thursday of the current week, whose year is the
	// ISO week-numbering year; week 1 contains January 4th.
	const thursday = new Date(Date.UTC(y, now.getUTCMonth(), now.getUTCDate()));
	thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
	const isoYear = thursday.getUTCFullYear();
	const jan4 = new Date(Date.UTC(isoYear, 0, 4));
	jan4.setUTCDate(jan4.getUTCDate() + 4 - (jan4.getUTCDay() || 7));
	const week = 1 + Math.round((thursday.getTime() - jan4.getTime()) / (7 * 86_400_000));
	return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export interface IGrantResult {
	granted: boolean; // false when this period's grant was already applied
	balance: bigint | null; // new balance when granted, null otherwise
}

// Apply a periodic grant exactly once per (subscriber, currency, period).
// The grant marker and the credit commit in ONE transaction, so a crash
// between them cannot mark a period as granted without crediting it.
export async function ensurePeriodicGrant(
	opts: IWalletSubscriber & {
		amount: bigint; // positive
		period: string; // from currentGrantPeriod()
		description?: string;
	},
	store: IStoreAdapter,
): Promise<IGrantResult> {
	if (opts.amount <= 0n) return { granted: false, balance: null };

	// Fast path: one indexed read per request once the period is granted.
	const [seen] = await store.query<{ period: string }>(
		`SELECT period FROM fonderie_wallet_grants
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3 AND period = $4`,
		[opts.subscriberType, opts.subscriberId, opts.currency, opts.period],
	);
	if (seen) return { granted: false, balance: null };

	try {
		return await store.transaction(async (tx) => {
			const [marked] = await tx.query<{ period: string }>(
				`INSERT INTO fonderie_wallet_grants (subscriber_type, subscriber_id, currency, period, amount)
				VALUES ($1, $2, $3, $4, $5)
				ON CONFLICT (subscriber_type, subscriber_id, currency, period) DO NOTHING
				RETURNING period`,
				[
					opts.subscriberType,
					opts.subscriberId,
					opts.currency,
					opts.period,
					opts.amount.toString(),
				],
			);
			// Lost the race — another request granted this period first.
			if (!marked) return { granted: false, balance: null };

			const balance = await applyBalanceCredit(tx, opts, opts.amount);

			await insertLedgerRow(tx, opts, {
				type: 'grant',
				amount: opts.amount,
				balanceAfter: balance,
				idempotencyKey: `grant:${opts.subscriberType}:${opts.subscriberId}:${opts.currency}:${opts.period}`,
				description: opts.description ?? `Periodic grant ${opts.period}`,
				metadata: { period: opts.period },
				providerTxId: null,
			});

			return { granted: true, balance };
		});
	} catch (err) {
		if (isIdempotencyConflict(err)) return { granted: false, balance: null };
		throw err;
	}
}
