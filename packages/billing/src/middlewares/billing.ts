import type { Middleware, ICourierMessage } from '@fonderie/core';
import { setApiResponse, HTTP, background } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import type { ICounterBackend } from '../backends/types';
import type { IBillingContext } from '../types';
import { MESSAGE_KEYS, EVENT_KEYS } from '../config';
import { getSubscription, isWithinDunningGrace } from '../services/subscriptions';
import { isWorkspaceMember } from '../services/membership';
import { buildBillingContext } from '../services/policy';
import {
	currentGrantPeriod,
	ensurePeriodicGrant,
	getWalletBalance,
	resolvePlanWallet,
	settleAllowance,
	startOfNextPeriod,
} from '../services/wallet';
import {
	resolveSubscriber,
	parseWindowMs,
	subscriberEventFields,
	formatWalletAmount,
	localizedAmounts,
} from '../utils';
import { notifyBilling } from '../services/notify';
import { maybeAutoRecharge } from '../services/auto-recharge';
import { claimNotice, releaseNotice } from '../services/notices';
import type { INoticeKey } from '../services/notices';

// Which threshold notices THIS process already knows are claimed, and for which
// period — a cache in front of the durable claim (fonderie_billing_notices), so
// a subscriber sitting over a limit does not cost a write on every request. It
// is never the authority: an in-process Set alone let every instance (and every
// serverless cold start) send its own copy of the same email.
const notified = new Map<string, string>();

export function withBilling(
	store: IStoreAdapter,
	config: IBillingConfig,
	backend: ICounterBackend,
	bus?: EventBus,
): Middleware {
	// True when this request should send the notice: the first claim of
	// `period` across all instances. If the durable claim cannot be reached the
	// notice still goes out, once per process — the behavior before the table.
	async function claimOnce(local: string, key: INoticeKey, period: string): Promise<boolean> {
		if (notified.get(local) === period) return false;
		notified.set(local, period);
		try {
			return await claimNotice(key, period, store);
		} catch {
			return true;
		}
	}

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

		// The adapter's bridge already ran this middleware for this very request
		// (see IFonderieContextMeta.bridged): its counters are incremented, its
		// grant and notices are done. Running again would count every
		// fonderie-routed request twice — halving every windowed plan limit.
		// Reuse that context when it is for the same subscriber.
		const bridged = (ctx.meta['bridged'] as Record<string, unknown> | undefined)?.['billing'] as
			| IBillingContext
			| undefined;
		if (
			bridged &&
			bridged.subscriber.type === subscriber.type &&
			bridged.subscriber.id === subscriber.id
		) {
			ctx.meta['billing'] = bridged;
			return next();
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
		const active = grantEligible || isWithinDunningGrace(subscription, config.dunning?.graceDays);

		const plan = config.plans.find((p) => p.name === planName) ?? config.plans[0];
		if (!plan) return next();

		// Entitlements follow PAYMENT, not the row's plan name. A subscription
		// that is incomplete (checkout never paid), unpaid, paused, or past_due
		// beyond the dunning grace still names its paid plan — only its status
		// says it isn't paying — so its features, limits and seats are the free
		// plan's (config.plans[0]), exactly as for a subscriber with no
		// subscription. The wallet below keeps the subscribed plan: its currency
		// is where the subscriber's balance lives, and new grants are already
		// gated on grantEligible.
		const entitledPlan = active ? plan : (config.plans[0] ?? plan);

		// Increment windowed (rate-limit) counters and read their current totals
		const counters: Record<string, number> = {};

		for (const [key, entry] of Object.entries(entitledPlan.policy ?? {})) {
			if ('enabled' in entry || !entry.window) continue;

			const windowMs = parseWindowMs(entry.window);
			const counterKey = `${subscriber.type}:${subscriber.id}:${key}`;
			counters[key] = await backend.increment(counterKey, windowMs);
		}

		// Build and cache billing context on ctx
		const billingCtx = buildBillingContext({ subscriber, plan: entitledPlan, active, counters });
		billingCtx.subscribedPlan = plan.name;
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
				// Settle a stale allowance FIRST (expire last period's unspent
				// granted credits per the rollover policy), regardless of grant
				// eligibility — so a past_due/downgraded subscriber can't keep
				// spending last period's allowance. Then grant this period.
				const period = currentGrantPeriod(planWallet.grantPeriod);
				const expiresAt = startOfNextPeriod(planWallet.grantPeriod);
				await settleAllowance(
					{ ...sub, period, rollover: planWallet.grantRollover, expiresAt },
					store,
				);
				// Grants require an active (or trialing) subscription — a past_due
				// or paused subscriber keeps spending existing credits but is not
				// extended new ones while payment is failing (grace preserves
				// ACCESS via `active`, but must not issue new credit → grantEligible).
				if (grantEligible && planWallet.grantAmount !== null && planWallet.grantAmount > 0n) {
					const grant = await ensurePeriodicGrant(
						{ ...sub, amount: planWallet.grantAmount, period, expiresAt },
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
						await background(bus?.emit(EVENT_KEYS.grantApplied, fields));
						await background(
							bus?.emit(EVENT_KEYS.walletCredited, { ...fields, source: 'periodic-grant' }),
						);
					}
				}
				const { balance } = await getWalletBalance(sub, store);
				billingCtx.wallet = {
					balance,
					currency: planWallet.currency,
					precision: planWallet.precision,
					overdraftLimit: planWallet.overdraftLimit,
					rates: planWallet.rates,
					// Carry the grant-period context so debitWalletForMetric can settle
					// a stale allowance in the same transaction as the spend.
					allowance: { period, rollover: planWallet.grantRollover, expiresAt },
				};

				// Low-balance signal — emitted once per crossing. The dedup flag
				// clears when the balance recovers above the threshold (hysteresis),
				// so a later re-drop signals again rather than staying silent for the
				// session. Fires the durable wallet.low_balance domain event and the
				// customer-facing billing.credits-low notice; both fire-and-forget.
				if (planWallet.lowBalanceAt !== null) {
					const lowKey = `${subscriber.type}:${subscriber.id}:low-balance`;
					const lowNotice = {
						subscriberType: subscriber.type,
						subscriberId: subscriber.id,
						notice: 'credits-low',
					};
					if (balance > planWallet.lowBalanceAt) {
						// Re-arm everywhere, not only here: the instance that sent the
						// notice may not be the one that sees the balance recover.
						// A failed re-arm must not cost the auto-recharge below.
						notified.delete(lowKey);
						await releaseNotice(lowNotice, store).catch(() => {});
					} else if (await claimOnce(lowKey, lowNotice, 'low')) {
						const fields = {
							...subscriberEventFields(subscriber.type, subscriber.id),
							currency: planWallet.currency,
							balance: balance.toString(),
							threshold: planWallet.lowBalanceAt.toString(),
						};
						// The durable domain event always fires; the customer EMAIL is
						// opt-out via config.notifications.creditsLow (default on).
						await background(bus?.emit(EVENT_KEYS.walletLowBalance, fields));
						if (config.notifications?.creditsLow !== false) {
							await background(
								notifyBilling(bus, config, {
									subscriberType: subscriber.type,
									subscriberId: subscriber.id,
									type: MESSAGE_KEYS.creditsLow,
									data: {
										plan: plan.name,
										currency: planWallet.currency,
										balance: balance.toString(),
										threshold: planWallet.lowBalanceAt.toString(),
										balanceDisplay: formatWalletAmount(
											balance,
											planWallet.currency,
											planWallet.precision ?? 2,
										),
										thresholdDisplay: formatWalletAmount(
											planWallet.lowBalanceAt,
											planWallet.currency,
											planWallet.precision ?? 2,
										),
										...localizedAmounts({
											balanceDisplay: { amount: balance, currency: planWallet.currency, precision: planWallet.precision ?? 2 },
											thresholdDisplay: { amount: planWallet.lowBalanceAt, currency: planWallet.currency, precision: planWallet.precision ?? 2 },
										}),
									},
								}),
							);
						}
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
			// Limit notices go out on the bus, to whoever resolveRecipient names
			// for the subscriber — for a workspace, the owner, not whichever member
			// made the request that crossed the line. Without a resolver + bus they
			// are left on ctx.meta.messages for the app to send itself.
			const toSubscriber = !!bus && typeof config.resolveRecipient === 'function';

			for (const [key, status] of Object.entries(billingCtx.statuses)) {
				if (status.type !== 'counter' || status.limit === null) continue;

				const base = `${subscriber.type}:${subscriber.id}:${key}`;
				// Once per counter window (and limit — a plan change moves the line).
				const period = `${status.resetsAt ?? 'lifetime'}|${status.limit}`;
				const noticeKey = (kind: string) => ({
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					notice: `limit-${kind}:${key}`,
				});

				if (config.notifications.softHit && status.status === 'over_limit') {
					const nk = `${base}:reached`;
					if (await claimOnce(nk, noticeKey('reached'), period)) {
						toNotify.push({
							type: MESSAGE_KEYS.limitReached,
							recipient,
							data: {
								key,
								plan: entitledPlan.name,
								limit: status.limit,
								used: status.used,
							},
						});
					}
				} else if (config.notifications.warnAt && status.status === 'warning') {
					const nk = `${base}:warning`;
					if (await claimOnce(nk, noticeKey('warning'), period)) {
						toNotify.push({
							type: MESSAGE_KEYS.limitWarning,
							recipient,
							data: {
								key,
								plan: entitledPlan.name,
								limit: status.limit,
								used: status.used,
							},
						});
					}
				} else {
					// Back below the warning threshold — typically when its window
					// resets. The durable claim re-arms by itself (the next crossing is
					// a new period); drop the local cache so the module-level Map
					// cannot grow unbounded.
					notified.delete(`${base}:reached`);
					notified.delete(`${base}:warning`);
				}
			}

			if (toNotify.length > 0 && toSubscriber) {
				for (const message of toNotify) {
					await background(
						notifyBilling(bus, config, {
							subscriberType: subscriber.type,
							subscriberId: subscriber.id,
							type: message.type,
							data: message.data ?? {},
						}),
					);
				}
			} else if (toNotify.length > 0) {
				const existing = ctx.meta['messages'] as ICourierMessage[] | undefined;
				ctx.meta['messages'] = [...(existing ?? []), ...toNotify];
			}
		}

		return next();
	};
}
