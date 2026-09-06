import { encodeKeysetCursor, decodeKeysetCursor } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type {
	IWalletBalance,
	IWalletLedgerEntry,
	IWalletRate,
	SubscriberType,
	WalletLedgerType,
} from '../types';
import type { IBillingConfig, IBillingPlan, IBillingWalletAutoRecharge } from '../config';
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

export interface IWalletReversalResult extends IWalletMutationResult {
	// Credits actually reversed by this call — 0 on a duplicate replay or when
	// the per-provider-tx cap left nothing to reverse. The caller emits events
	// and notifies only when this is > 0.
	reversed: bigint;
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
	grantedAmount?: string;
	grantedExpiresAt?: string | Date | null;
	spendPurchased?: boolean;
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
		// When set, a stale allowance is settled in the SAME transaction before
		// spending, so expired credits can never be spent (no lazy-settle window).
		// debitWalletForMetric always passes this; pass it from any hybrid debit.
		allowance?: {
			period: string; // currentGrantPeriod()
			rollover: 'none' | 'full' | { cap: bigint };
			expiresAt: Date; // startOfNextPeriod()
		};
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

			// Lock the row (creating it first so FOR UPDATE has something to lock)
			// and read the allowance columns — concurrent debits serialize here.
			const locked = await lockAllowance(tx, opts);
			let current = locked.amount;
			let granted = locked.granted;

			// Settle a stale allowance in THIS transaction before spending, so
			// expired credits can never be spent (no lazy-settle window).
			if (opts.allowance) {
				const s = await applySettleInTx(
					tx,
					opts,
					locked,
					opts.allowance.period,
					opts.allowance.rollover,
					opts.allowance.expiresAt,
				);
				current = s.amount;
				granted = s.granted;
			}
			const spendPurchased = locked.spendPurchased;

			// Allowance-first: draw the free allowance before purchased credits.
			const fromGranted = granted <= 0n ? 0n : opts.amount < granted ? opts.amount : granted;
			const fromPurchased = opts.amount - fromGranted;

			// Guard: with the toggle ON the overdraft floor bounds the TOTAL (so
			// overdraft eats purchased, never granted); with it OFF a debit may only
			// consume the allowance and is refused once it is exhausted.
			if (spendPurchased) {
				if (current - opts.amount < floor) {
					throw new InsufficientFundsError(current, opts.amount, opts.currency);
				}
			} else if (opts.amount > granted) {
				throw new InsufficientFundsError(granted, opts.amount, opts.currency);
			}

			const [updated] = spendPurchased
				? await tx.query<{ amount: string; grantedAmount: string }>(
						`UPDATE fonderie_wallet_balances
						SET amount = amount - $4::bigint,
							granted_amount = granted_amount - LEAST($4::bigint, GREATEST(granted_amount, 0)),
							version = version + 1, updated_at = now()
						WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3
							AND amount - $4::bigint >= $5::bigint
						RETURNING amount, granted_amount AS "grantedAmount"`,
						[opts.subscriberType, opts.subscriberId, opts.currency, opts.amount.toString(), floor.toString()],
					)
				: await tx.query<{ amount: string; grantedAmount: string }>(
						`UPDATE fonderie_wallet_balances
						SET amount = amount - $4::bigint,
							granted_amount = granted_amount - $4::bigint,
							version = version + 1, updated_at = now()
						WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3
							AND granted_amount - $4::bigint >= 0
						RETURNING amount, granted_amount AS "grantedAmount"`,
						[opts.subscriberType, opts.subscriberId, opts.currency, opts.amount.toString()],
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
				metadata: {
					...(opts.metadata ?? {}),
					fromGranted: fromGranted.toString(),
					fromPurchased: fromPurchased.toString(),
					grantedAfter: updated.grantedAmount,
				},
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

// Reverse credits from a prior purchase — a refund or chargeback clawback.
// DELIBERATELY floor-free (unlike debitWallet): a clawback must be able to
// drive the balance negative when the buyer already spent the credits — that
// is the whole point of closing the "buy → spend → refund" value-leak. A
// negative balance is "credits owed back"; the next grant/purchase nets against
// it. Records a negative 'refund' ledger row carrying the reversing provider tx
// id for reconciliation. Idempotent on idempotencyKey (key off the refund's OWN
// id, never the charge — partial refunds each need a distinct reversal).
// Pass the module-level store — never a tx-scoped adapter (see file header).
export async function reverseWallet(
	opts: IWalletSubscriber & {
		amount: bigint; // positive; recorded as a negative 'refund' row
		idempotencyKey: string;
		providerTxId?: string;
		// Ceiling on cumulative reversed credits for providerTxId, enforced
		// INSIDE the transaction under a per-providerTxId advisory lock so
		// concurrent reversals for one charge (e.g. a refund and a chargeback)
		// can never over-reverse past what was granted. Requires providerTxId.
		// When set, the amount actually applied is clamped to what remains and
		// returned as `reversed`.
		capToProviderTxId?: bigint;
		description?: string;
		metadata?: Record<string, unknown>;
	},
	store: IStoreAdapter,
): Promise<IWalletReversalResult> {
	if (opts.amount < 0n) throw new Error('[billing:wallet] reverse amount must be positive');
	if (!opts.idempotencyKey) throw new Error('[billing:wallet] idempotencyKey is required');
	if (opts.amount === 0n) {
		return { balance: await readBalance(opts, store), duplicate: false, reversed: 0n };
	}

	try {
		return await store.transaction(async (tx) => {
			const existing = await findByIdempotencyKey(opts, opts.idempotencyKey, tx);
			if (existing) return { balance: await readBalance(opts, tx), duplicate: true, reversed: 0n };

			let applied = opts.amount;
			if (opts.capToProviderTxId != null && opts.providerTxId) {
				// Serialize all reversals for this charge, then re-check the cap
				// against the authoritative in-transaction sum — closing the race
				// where two concurrent reversals both read a stale pre-tx total.
				await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [opts.providerTxId]);
				const [row] = await tx.query<{ total: string | null }>(
					`SELECT COALESCE(SUM(amount), 0) AS total FROM fonderie_wallet_ledger
					WHERE provider_tx_id = $1 AND type = 'refund'`,
					[opts.providerTxId],
				);
				const remaining = opts.capToProviderTxId + BigInt(row?.total ?? '0'); // total is <= 0
				if (remaining <= 0n) return { balance: await readBalance(opts, tx), duplicate: false, reversed: 0n };
				if (applied > remaining) applied = remaining;
			}

			// Unconditional upsert-add of a negative amount — no floor; a negative
			// balance is "credits owed back". The same-transaction ledger row with
			// its UNIQUE key makes a concurrent identical replay roll back cleanly.
			const balance = await applyBalanceCredit(tx, opts, -applied);

			await insertLedgerRow(tx, opts, {
				type: 'refund',
				amount: -applied,
				balanceAfter: balance,
				idempotencyKey: opts.idempotencyKey,
				description: opts.description ?? null,
				metadata: opts.metadata ?? {},
				providerTxId: opts.providerTxId ?? null,
			});

			return { balance, duplicate: false, reversed: applied };
		});
	} catch (err) {
		if (isIdempotencyConflict(err)) {
			return { balance: await readBalance(opts, store), duplicate: true, reversed: 0n };
		}
		throw err;
	}
}

export interface IWalletPurchaseRow {
	subscriberType: SubscriberType;
	subscriberId: string;
	currency: string;
	/** Credits originally granted (the positive purchase ledger amount). */
	credits: bigint;
	metadata: Record<string, unknown>;
}

// Recover the original credit-pack purchase for a provider transaction (the
// PaymentIntent). A refund/chargeback event carries no wallet metadata — the
// PaymentIntent is its only link back to who was credited and how much — so
// this is the join a clawback depends on. Returns the earliest matching
// purchase (a PI maps to one checkout), or null (unlinked purchase, or the
// refund arrived before the credit).
export async function findPurchaseByProviderTxId(
	providerTxId: string,
	store: IStoreAdapter,
): Promise<IWalletPurchaseRow | null> {
	const [row] = await store.query<{
		subscriberType: SubscriberType;
		subscriberId: string;
		currency: string;
		amount: string;
		metadata: Record<string, unknown> | null;
	}>(
		`SELECT
			subscriber_type AS "subscriberType",
			subscriber_id   AS "subscriberId",
			currency,
			amount,
			metadata
		FROM fonderie_wallet_ledger
		WHERE provider_tx_id = $1 AND type = 'purchase'
		ORDER BY created_at ASC
		LIMIT 1`,
		[providerTxId],
	);
	if (!row) return null;
	return {
		subscriberType: row.subscriberType,
		subscriberId: row.subscriberId,
		currency: row.currency,
		credits: BigInt(row.amount),
		metadata: row.metadata ?? {},
	};
}

// Net credits already reversed for a provider transaction = -(sum of 'refund'
// row amounts for that PI). Clawbacks are negative 'refund' rows and a
// dispute-won re-credit is a positive 'refund' row, so this nets correctly and
// lets the caller cap a new clawback at the originally-credited amount — no
// combination of partial refunds and disputes can ever over-reverse.
export async function sumReversedCreditsByProviderTxId(
	providerTxId: string,
	store: IStoreAdapter,
): Promise<bigint> {
	const [row] = await store.query<{ total: string | null }>(
		`SELECT COALESCE(SUM(amount), 0) AS total
		FROM fonderie_wallet_ledger
		WHERE provider_tx_id = $1 AND type = 'refund'`,
		[providerTxId],
	);
	return -BigInt(row?.total ?? '0');
}

// The signed amount of a single ledger row by its idempotency key, or null if
// none. Used to re-credit exactly what a dispute clawback removed when that
// dispute is later won.
export async function findLedgerAmountByKey(
	idempotencyKey: string,
	store: IStoreAdapter,
): Promise<bigint | null> {
	const [row] = await store.query<{ amount: string }>(
		`SELECT amount FROM fonderie_wallet_ledger WHERE idempotency_key = $1`,
		[idempotencyKey],
	);
	return row ? BigInt(row.amount) : null;
}

export async function getWalletBalance(
	sub: IWalletSubscriber,
	store: IStoreAdapter,
): Promise<IWalletBalance> {
	const [row] = await store.query<IBalanceRow>(
		`SELECT amount, version, updated_at AS "updatedAt",
			granted_amount AS "grantedAmount",
			granted_expires_at AS "grantedExpiresAt",
			spend_purchased AS "spendPurchased"
		FROM fonderie_wallet_balances
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
		[sub.subscriberType, sub.subscriberId, sub.currency],
	);
	if (!row) return { balance: 0n, version: 0, updatedAt: null, granted: 0n, purchased: 0n, spendPurchased: true, grantedExpiresAt: null };
	const balance = BigInt(row.amount);
	const storedGranted = BigInt(row.grantedAmount ?? '0');
	const expiresAt = row.grantedExpiresAt ? new Date(row.grantedExpiresAt) : null;
	// A metered debit / withBilling settles a stale allowance before it is spent.
	// For a read that no settle reached (e.g. a subscriber who downgraded to a
	// plan with no wallet keeps a stale granted_amount), don't advertise an
	// EXPIRED allowance as live — report granted 0 once past its expiry. The
	// stored credits still sit in `balance`; they are burned by the next settle.
	const expired = expiresAt !== null && expiresAt.getTime() <= Date.now();
	const granted = expired ? 0n : storedGranted;
	return {
		balance,
		version: Number(row.version),
		updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
		granted,
		purchased: balance - granted,
		spendPurchased: row.spendPurchased ?? true,
		grantedExpiresAt: expired ? null : (expiresAt ? expiresAt.toISOString() : null),
	};
}

// Set the per-subscriber spend-purchased toggle for one (subscriber, currency)
// bucket. UPSERT, not UPDATE: a subscriber who has never been credited has no
// balance row, so a bare UPDATE would silently persist nothing — the created row
// starts at amount 0. Naturally idempotent (a boolean, no ledger row); still
// bumps version/updated_at like every balance write. Targets the SAME bucket the
// spend paths read (getWalletBalance / lockAllowance).
export async function setSpendPurchased(
	opts: IWalletSubscriber & { spendPurchased: boolean },
	store: IStoreAdapter,
): Promise<void> {
	await store.query(
		`INSERT INTO fonderie_wallet_balances (subscriber_type, subscriber_id, currency, amount, spend_purchased)
		VALUES ($1, $2, $3, 0, $4)
		ON CONFLICT (subscriber_type, subscriber_id, currency) DO UPDATE SET
			spend_purchased = EXCLUDED.spend_purchased,
			version         = fonderie_wallet_balances.version + 1,
			updated_at      = now()`,
		[opts.subscriberType, opts.subscriberId, opts.currency, opts.spendPurchased],
	);
}

export interface IWalletLedgerPage {
	entries: IWalletLedgerEntry[];
	// Opaque cursor for the next (older) page, or null when exhausted.
	nextCursor: string | null;
}

// The wallet ledger's keyset cursor is the shared @fonderie/core primitive
// (range-checked decode → 422 not a ::timestamptz 500; accepts PG's text form).
// Aliased to the historical names so billing's public API + internal callers
// are unchanged.
export const encodeLedgerCursor = encodeKeysetCursor;
export const decodeLedgerCursor = decodeKeysetCursor;

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
	/** Balance at/below which withBilling signals a low balance. null disables. */
	lowBalanceAt: bigint | null;
	/** Off-session auto-recharge economics. null disables. */
	autoRecharge: IBillingWalletAutoRecharge | null;
	/** Rollover policy for unspent granted (allowance) credits at period end. */
	grantRollover: 'none' | 'full' | { cap: bigint };
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
		lowBalanceAt: plan.wallet.lowBalanceAt ?? null,
		autoRecharge: plan.wallet.autoRecharge ?? null,
		grantRollover: plan.wallet.grantRollover ?? 'none',
	};
}

// The instant the current grant period ends (== start of the next period), UTC.
// Advisory: stored as granted_expires_at for display; the authority for expiry
// is a granted_period vs currentGrantPeriod() mismatch, settled before spend.
export function startOfNextPeriod(period: 'month' | 'week' | 'day', now = new Date()): Date {
	const y = now.getUTCFullYear();
	const mo = now.getUTCMonth();
	const d = now.getUTCDate();
	if (period === 'month') return new Date(Date.UTC(y, mo + 1, 1));
	if (period === 'day') return new Date(Date.UTC(y, mo, d + 1));
	// Week: next ISO week starts on the coming Monday (UTC).
	const dow = now.getUTCDay() || 7; // 1..7, Monday..Sunday
	return new Date(Date.UTC(y, mo, d + (8 - dow)));
}

// How much of an unspent allowance survives into the next period under a policy.
function rolloverKept(granted: bigint, rollover: 'none' | 'full' | { cap: bigint }): bigint {
	if (granted <= 0n) return 0n;
	if (rollover === 'full') return granted;
	if (rollover === 'none') return 0n;
	return granted < rollover.cap ? granted : rollover.cap;
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

// Locked-row view of a balance's allowance columns.
interface ILockedAllowance {
	amount: bigint;
	granted: bigint;
	grantedPeriod: string | null;
	spendPurchased: boolean;
}

// Read + lock the allowance columns (creating the row first so FOR UPDATE has
// something to lock). Serializes with concurrent debits/settles/grants.
async function lockAllowance(tx: IStoreAdapter, sub: IWalletSubscriber): Promise<ILockedAllowance> {
	await tx.query(
		`INSERT INTO fonderie_wallet_balances (subscriber_type, subscriber_id, currency, amount)
		VALUES ($1, $2, $3, 0)
		ON CONFLICT (subscriber_type, subscriber_id, currency) DO NOTHING`,
		[sub.subscriberType, sub.subscriberId, sub.currency],
	);
	const [row] = await tx.query<{
		amount: string;
		grantedAmount: string;
		grantedPeriod: string | null;
		spendPurchased: boolean;
	}>(
		`SELECT amount, granted_amount AS "grantedAmount", granted_period AS "grantedPeriod",
			spend_purchased AS "spendPurchased"
		FROM fonderie_wallet_balances
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3
		FOR UPDATE`,
		[sub.subscriberType, sub.subscriberId, sub.currency],
	);
	return {
		amount: BigInt(row?.amount ?? '0'),
		granted: BigInt(row?.grantedAmount ?? '0'),
		grantedPeriod: row?.grantedPeriod ?? null,
		spendPurchased: row?.spendPurchased ?? true,
	};
}

// Expire a stale allowance under an already-held FOR UPDATE lock. When the
// stored granted_period differs from the current period, unspent granted credits
// are burned per the rollover policy (a negative 'expiry' ledger row + a reduced
// total), the surviving amount stays 'granted', and granted_period advances. When
// granted_period is null (never granted) or already current, this is a no-op.
// Returns the post-settle amount + granted. PURCHASED (amount - granted) is never
// touched. The expiry key is stable per stale period, so it is replay-safe.
async function applySettleInTx(
	tx: IStoreAdapter,
	sub: IWalletSubscriber,
	cur: ILockedAllowance,
	period: string,
	rollover: 'none' | 'full' | { cap: bigint },
	expiresAt: Date,
): Promise<{ amount: bigint; granted: bigint; settled: boolean }> {
	if (cur.grantedPeriod === null || cur.grantedPeriod === period) {
		return { amount: cur.amount, granted: cur.granted, settled: false };
	}
	const kept = rolloverKept(cur.granted, rollover);
	const expired = cur.granted - kept;
	let amount = cur.amount;
	if (expired > 0n) {
		amount = cur.amount - expired;
		await insertLedgerRow(tx, sub, {
			type: 'expiry',
			amount: -expired,
			balanceAfter: amount,
			idempotencyKey: `expiry:${sub.subscriberType}:${sub.subscriberId}:${sub.currency}:${cur.grantedPeriod}`,
			description: `Allowance expiry ${cur.grantedPeriod}`,
			metadata: {
				period: cur.grantedPeriod,
				keptAfter: kept.toString(),
				rollover: typeof rollover === 'object' ? { cap: rollover.cap.toString() } : rollover,
			},
			providerTxId: null,
		});
	}
	await tx.query(
		`UPDATE fonderie_wallet_balances
		SET amount = $4, granted_amount = $5, granted_period = $6, granted_expires_at = $7,
			version = version + 1, updated_at = now()
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
		[sub.subscriberType, sub.subscriberId, sub.currency, amount.toString(), kept.toString(), period, expiresAt.toISOString()],
	);
	return { amount, granted: kept, settled: expired > 0n };
}

// Expire a stale allowance (settle-only, no grant). Idempotent + cheap: a fast
// indexed read short-circuits when granted_period is already current. Called
// before every debit entry point and before a balance read, so a stale allowance
// is burned before it can be spent or reported. Pass the module-level store.
export async function settleAllowance(
	opts: IWalletSubscriber & {
		period: string; // currentGrantPeriod()
		rollover: 'none' | 'full' | { cap: bigint };
		expiresAt: Date; // startOfNextPeriod()
	},
	store: IStoreAdapter,
): Promise<{ settled: boolean }> {
	// Fast path: nothing to expire when the row is fresh or was never granted.
	const [row] = await store.query<{ grantedPeriod: string | null; grantedAmount: string }>(
		`SELECT granted_period AS "grantedPeriod", granted_amount AS "grantedAmount"
		FROM fonderie_wallet_balances
		WHERE subscriber_type = $1 AND subscriber_id = $2 AND currency = $3`,
		[opts.subscriberType, opts.subscriberId, opts.currency],
	);
	if (!row || row.grantedPeriod === null || row.grantedPeriod === opts.period) {
		return { settled: false };
	}
	try {
		return await store.transaction(async (tx) => {
			const cur = await lockAllowance(tx, opts);
			const res = await applySettleInTx(tx, opts, cur, opts.period, opts.rollover, opts.expiresAt);
			return { settled: res.settled };
		});
	} catch (err) {
		if (isIdempotencyConflict(err)) return { settled: false };
		throw err;
	}
}

// Apply a periodic grant exactly once per (subscriber, currency, period). The
// grant marker and the credit commit in ONE transaction, so a crash between them
// cannot mark a period as granted without crediting it. The credited amount goes
// into the ALLOWANCE (granted) bucket — non-stackable, expires next period. The
// caller must settle the prior period first (withBilling does); pass expiresAt so
// this period's allowance carries its expiry.
export async function ensurePeriodicGrant(
	opts: IWalletSubscriber & {
		amount: bigint; // positive
		period: string; // from currentGrantPeriod()
		expiresAt?: Date; // startOfNextPeriod(); stored as granted_expires_at
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

			// Credit BOTH the total and the allowance bucket, and stamp the period
			// so the next period's settle knows what to expire.
			const [row] = await tx.query<{ amount: string }>(
				`INSERT INTO fonderie_wallet_balances
					(subscriber_type, subscriber_id, currency, amount, granted_amount, granted_period, granted_expires_at)
				VALUES ($1, $2, $3, $4, $4, $5, $6)
				ON CONFLICT (subscriber_type, subscriber_id, currency) DO UPDATE SET
					amount             = fonderie_wallet_balances.amount + EXCLUDED.amount,
					granted_amount     = fonderie_wallet_balances.granted_amount + EXCLUDED.granted_amount,
					granted_period     = EXCLUDED.granted_period,
					granted_expires_at = EXCLUDED.granted_expires_at,
					version            = fonderie_wallet_balances.version + 1,
					updated_at         = now()
				RETURNING amount`,
				[
					opts.subscriberType,
					opts.subscriberId,
					opts.currency,
					opts.amount.toString(),
					opts.period,
					opts.expiresAt?.toISOString() ?? null,
				],
			);
			const balance = BigInt(row?.amount ?? '0');

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
