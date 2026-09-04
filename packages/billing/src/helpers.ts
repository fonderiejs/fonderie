import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { IBillingContext, IPolicyStatus, IWalletContext } from './types';
import { debitWallet } from './services/wallet';
import type { IWalletMutationResult } from './services/wallet';

function getBillingContext(ctx: IFonderieContext): IBillingContext | null {
	return (ctx.meta['billing'] as IBillingContext | undefined) ?? null;
}

// Returns true if the feature flag is enabled on the subscriber's plan.
// Returns true when no billing context is present (fail-open when billing not configured).
export function hasFeature(ctx: IFonderieContext, key: string): boolean {
	const billing = getBillingContext(ctx);
	if (!billing) return true;

	const status = billing.statuses[key];
	if (!status) return true; // key not declared in policy → allow
	if (status.type === 'feature') return status.enabled;
	return true; // counter entry = feature present
}

// Returns the advertised limit for a counter policy key, or null if unlimited / not configured.
export function getPlanLimit(ctx: IFonderieContext, key: string): number | null {
	const billing = getBillingContext(ctx);
	if (!billing) return null;

	const status = billing.statuses[key];
	if (!status || status.type === 'feature') return null;
	return status.limit;
}

// Returns the full policy status for a key, or null if not configured.
export function getLimitStatus(ctx: IFonderieContext, key: string): IPolicyStatus | null {
	const billing = getBillingContext(ctx);
	if (!billing) return null;
	return billing.statuses[key] ?? null;
}

// Returns the wallet snapshot cached by withBilling, or null when the wallet
// subsystem is off or the subscriber's plan defines no wallet.
export function getWalletStatus(ctx: IFonderieContext): IWalletContext | null {
	return getBillingContext(ctx)?.wallet ?? null;
}

// The plan's unit cost for a metric, or null when the metric is not priced
// (no wallet, or no rate for the key) — null means "no charge".
export function getWalletRate(ctx: IFonderieContext, metric: string): bigint | null {
	return getWalletStatus(ctx)?.rates[metric]?.cost ?? null;
}

// Middleware — checks (does NOT debit) that the subscriber can afford one
// unit of `metric` at the plan's rate. The actual deduction must happen
// atomically in the unit of work via debitWallet/debitWalletForMetric — a
// middleware-time debit would charge for requests that later fail, and a
// middleware-time check alone can never reserve funds. Fails open when the
// wallet or the rate is not configured, like requireFeature.
export function requireWalletBalance(metric: string): Middleware {
	return (ctx, next) => {
		const wallet = getWalletStatus(ctx);
		const cost = wallet?.rates[metric]?.cost;
		if (!wallet || cost === undefined || cost === 0n) return next();

		if (wallet.balance - cost < -wallet.overdraftLimit) {
			return Promise.resolve(
				setApiResponse(HTTP.PAYMENT_REQUIRED, 'INSUFFICIENT_CREDITS', 'Insufficient credits', {
					metric,
					cost: cost.toString(),
					balance: wallet.balance.toString(),
					currency: wallet.currency,
				}),
			);
		}
		return next();
	};
}

// Debit the caller's wallet at the plan rate for `metric` — the deduction
// product code calls inside its unit of work, with an idempotency key derived
// from that unit (e.g. a task id) so retries never double-charge. Returns
// null (charging nothing) when the wallet or the rate is not configured or
// the rate is zero (e.g. unlimited plans). Throws InsufficientFundsError past
// the plan's overdraft floor.
export async function debitWalletForMetric(
	ctx: IFonderieContext,
	metric: string,
	opts: {
		idempotencyKey: string;
		quantity?: number;
		description?: string;
		metadata?: Record<string, unknown>;
	},
	store: IStoreAdapter,
): Promise<IWalletMutationResult | null> {
	const quantity = opts.quantity ?? 1;
	if (!Number.isInteger(quantity) || quantity <= 0) {
		throw new Error('[billing:wallet] quantity must be a positive integer');
	}

	const billing = getBillingContext(ctx);
	const wallet = billing?.wallet;
	const cost = wallet?.rates[metric]?.cost;
	if (!billing || !wallet || cost === undefined || cost === 0n) return null;

	return debitWallet(
		{
			subscriberType: billing.subscriber.type,
			subscriberId: billing.subscriber.id,
			currency: wallet.currency,
			amount: cost * BigInt(quantity),
			overdraftLimit: wallet.overdraftLimit,
			idempotencyKey: opts.idempotencyKey,
			description: opts.description ?? metric,
			metadata: { metric, quantity, ...(opts.metadata ?? {}) },
		},
		store,
	);
}

// Middleware — gates a route behind a feature flag.
// Reads from cached ctx.meta['billing']; no store arg, no async DB call.
// Fails open if billing context is absent (billing module not registered).
export function requireFeature(key: string): Middleware {
	return (ctx, next) => {
		if (!hasFeature(ctx, key)) {
			return Promise.resolve(
				setApiResponse(
					HTTP.PAYMENT_REQUIRED,
					'FEATURE_UNAVAILABLE',
					`Feature '${key}' is not available on your current plan`,
				),
			);
		}
		return next();
	};
}
