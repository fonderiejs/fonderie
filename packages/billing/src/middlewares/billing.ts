import type { Middleware, ICourierMessage } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import type { ICounterBackend } from '../backends/types';
import { MESSAGE_KEYS, EVENT_KEYS } from '../config';
import { getSubscription, isWithinDunningGrace } from '../services/subscriptions';
import { isWorkspaceMember } from '../services/membership';
import { buildBillingContext } from '../services/policy';
import {
	currentGrantPeriod,
	ensurePeriodicGrant,
	getWalletBalance,
	resolvePlanWallet,
} from '../services/wallet';
import { resolveSubscriber, parseWindowMs, subscriberEventFields } from '../utils';
import { notifyBilling } from '../services/notify';
import { maybeAutoRecharge } from '../services/auto-recharge';

// In-process de-dup: tracks which threshold notifications have fired this session.
// Acceptable to lose on restart (may send one duplicate after a redeploy).
const notified = new Set<string>();

export function withBilling(
	store: IStoreAdapter,
	config: IBillingConfig,
	backend: ICounterBackend,
	bus?: EventBus,
): Middleware {
	return async (ctx, next) => {
		const subscriber = resolveSubscriber(ctx);

		// No subscriber (unauthenticated / public route) — skip entirely
		if (!subscriber) return next();

		// SECURITY — workspace subscribers can come from the raw X-Workspace-ID
		// header. Trust the id only when it matches ctx.workspace (already
		// membership-verified by @fonderie/workspaces' withWorkspace) or when
		// the session user proves active membership here. Anything else would
		// let any caller read, drain, or rate-limit another tenant's billing.
		if (subscriber.type === 'workspace' && ctx.workspace?.id !== subscriber.id) {
			// Anonymous request naming a workspace: no billing context at all —
			// public routes keep working, and an unverified workspace's counters
			// and wallet stay untouched.
			if (!ctx.user) return next();
			if (!(await isWorkspaceMember(ctx.user.id, subscriber.id, store))) {
				return setApiResponse(HTTP.FORBIDDEN, 'FORBIDDEN', 'Not a member of this workspace');
			}
		}

		// Resolve subscription → plan name (fall back to first plan = free)
		const subscription = await getSubscription(subscriber.type, subscriber.id, store);
		const planName = subscription?.plan ?? config.plans[0]?.name ?? 'free';
		// Paying (or free/trialing) — the basis for issuing NEW value (grants).
			const grantEligible =
				!subscription || subscription.status === 'active' || subscription.status === 'trialing';
			// Access — extends `grantEligible` with the dunning grace window, so a
			// past_due subscriber keeps plan access + can spend during retries. It
			// must NOT feed the grant gate (grace preserves access, never hands out
			// new billed credit while payment is failing).
			const active =
				grantEligible || isWithinDunningGrace(subscription, config.dunning?.graceDays);

		const plan = config.plans.find((p) => p.name === planName) ?? config.plans[0];
		if (!plan) return next();

		// Increment windowed (rate-limit) counters and read their current totals
		const counters: Record<string, number> = {};

		for (const [key, entry] of Object.entries(plan.policy ?? {})) {
			if ('enabled' in entry || !entry.window) continue;

			const windowMs = parseWindowMs(entry.window);
			const counterKey = `${subscriber.type}:${subscriber.id}:${key}`;
			counters[key] = await backend.increment(counterKey, windowMs);
		}

		// Build and cache billing context on ctx
		const billingCtx = buildBillingContext({ subscriber, plan, active, counters });
		ctx.meta['billing'] = billingCtx;

		// Wallet economics — lazy periodic grant, then a balance snapshot for
		// requireWalletBalance and product code. Non-fatal by design: a wallet
		// hiccup must not take down unrelated requests.
		const planWallet = resolvePlanWallet(plan, config);
		if (planWallet) {
			try {
				const sub = {
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					currency: planWallet.currency,
				};
				// Grants require an active (or trialing) subscription — a past_due
				// or paused subscriber keeps spending existing credits but is not
				// extended new ones while payment is failing (grace preserves
				// ACCESS via `active`, but must not issue new credit → grantEligible).
				if (grantEligible && planWallet.grantAmount !== null && planWallet.grantAmount > 0n) {
					const period = currentGrantPeriod(planWallet.grantPeriod);
					const grant = await ensurePeriodicGrant(
						{ ...sub, amount: planWallet.grantAmount, period },
						store,
					);
					// Emit only when the grant was newly applied this period —
					// ensurePeriodicGrant is idempotent per period, so a repeat
					// request returns granted:false and must not re-emit.
					if (grant.granted) {
						const fields = {
							...subscriberEventFields(subscriber.type, subscriber.id),
							currency: planWallet.currency,
							credits: planWallet.grantAmount.toString(),
							balanceAfter: grant.balance?.toString() ?? null,
							period,
						};
						bus?.emit(EVENT_KEYS.grantApplied, fields).catch(() => {});
						bus
							?.emit(EVENT_KEYS.walletCredited, { ...fields, source: 'periodic-grant' })
							.catch(() => {});
					}
				}
				const { balance } = await getWalletBalance(sub, store);
				billingCtx.wallet = {
					balance,
					currency: planWallet.currency,
					precision: planWallet.precision,
					overdraftLimit: planWallet.overdraftLimit,
					rates: planWallet.rates,
				};

				// Low-balance signal — emitted once per crossing. The dedup flag
				// clears when the balance recovers above the threshold (hysteresis),
				// so a later re-drop signals again rather than staying silent for the
				// session. Fires the durable wallet.low_balance domain event and the
				// customer-facing billing.credits-low notice; both fire-and-forget.
				if (planWallet.lowBalanceAt !== null) {
					const lowKey = `${subscriber.type}:${subscriber.id}:low-balance`;
					if (balance > planWallet.lowBalanceAt) {
						notified.delete(lowKey);
					} else if (!notified.has(lowKey)) {
						notified.add(lowKey);
						const fields = {
							...subscriberEventFields(subscriber.type, subscriber.id),
							currency: planWallet.currency,
							balance: balance.toString(),
							threshold: planWallet.lowBalanceAt.toString(),
						};
						bus?.emit(EVENT_KEYS.walletLowBalance, fields).catch(() => {});
						void notifyBilling(bus, config, {
							subscriberType: subscriber.type,
							subscriberId: subscriber.id,
							type: MESSAGE_KEYS.creditsLow,
							data: {
								plan: plan.name,
								currency: planWallet.currency,
								balance: balance.toString(),
								threshold: planWallet.lowBalanceAt.toString(),
							},
						});
					}
				}

				// Auto-recharge — fire-and-forget; maybeAutoRecharge owns every
				// safety property (atomic per-subscriber claim, idempotent credit,
				// failure backoff + disable). An off-session charge must never block
				// or fail the request, so its outcome is deliberately ignored here.
				if (planWallet.autoRecharge) {
					void maybeAutoRecharge({
						store,
						config,
						bus,
						subscriberType: subscriber.type,
						subscriberId: subscriber.id,
						balance,
						planWallet,
					}).catch(() => {});
				}
			} catch (err) {
				// eslint-disable-next-line no-console
				console.error('[billing] wallet context failed:', (err as Error).message);
			}
		}

		// Block requests that have hit a hard limit
		for (const [key, status] of Object.entries(billingCtx.statuses)) {
			if (status.type === 'counter' && status.status === 'blocked') {
				return setApiResponse(
					HTTP.TOO_MANY_REQUESTS,
					'RATE_LIMIT_EXCEEDED',
					`Limit exceeded for: ${key}`,
					{ key, limit: status.limit, used: status.used, resetsAt: status.resetsAt },
				);
			}
		}

		// Fire threshold notifications (once per subscriber per key per session)
		if (config.notifications) {
			const toNotify: ICourierMessage[] = [];
			const recipient = {
				email: ctx.user?.email ?? null,
				phone: null,
				deviceToken: null,
			};

			for (const [key, status] of Object.entries(billingCtx.statuses)) {
				if (status.type !== 'counter' || status.limit === null) continue;

				const base = `${subscriber.type}:${subscriber.id}:${key}`;

				if (config.notifications.softHit && status.status === 'over_limit') {
					const nk = `${base}:reached`;
					if (!notified.has(nk)) {
						notified.add(nk);
						toNotify.push({
							type: MESSAGE_KEYS.limitReached,
							recipient,
							data: {
								key,
								plan: plan.name,
								limit: status.limit,
								used: status.used,
							},
						});
					}
				} else if (config.notifications.warnAt && status.status === 'warning') {
					const nk = `${base}:warning`;
					if (!notified.has(nk)) {
						notified.add(nk);
						toNotify.push({
							type: MESSAGE_KEYS.limitWarning,
							recipient,
							data: {
								key,
								plan: plan.name,
								limit: status.limit,
								used: status.used,
							},
						});
					}
				}
			}

			if (toNotify.length > 0) {
				const existing = ctx.meta['messages'] as ICourierMessage[] | undefined;
				ctx.meta['messages'] = [...(existing ?? []), ...toNotify];
			}
		}

		return next();
	};
}
