import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig, IBillingPlan, IBillingPlanPrice } from '../config';
import type { BillingInterval } from '../types';
import { BILLING_INTERVAL, BILLING_INTERVALS, isBillingInterval } from '../types';
import { PlanModel } from '../models/plan.model';
import { SubscriptionModel } from '../models/subscription.model';
import { resolveSubscriber } from '../utils';

// Only a clear UPGRADE is applied to a live subscription in place (immediate,
// prorated charge — the same mechanism Claude's own subscription uses). Cross-
// plan direction comes from tier (both plans must be tiered); a same-plan switch
// is an upgrade only when it commits from monthly to yearly. Everything else — a
// downgrade, a year→month switch, a lateral/same-tier move, or an untiered pair
// we can't rank — is NOT done in place: the member cancels (keeping access until
// the period ends) and subscribes to the lower plan once the current membership
// is over. That removes any path to consume a higher plan mid-cycle and then
// downgrade for a credit.
//
// Two hard guards run BEFORE the tier ranking, because tier order is operator-
// supplied and need not track price:
//   1. A year→month switch is NEVER an in-place upgrade regardless of tier —
//      swapping a prepaid annual price for a monthly one releases the unused
//      annual value as an account credit (a refund-like effect).
//   2. When both amounts are known and the interval is unchanged, a target that
//      costs LESS than the current price is never an upgrade — this backstops a
//      tier number that isn't monotonic with price.
function isClearUpgrade(
	current: { plan: string; interval: string; tier?: number | undefined; amount?: bigint | undefined },
	target: { plan: string; interval: string; tier?: number | undefined; amount?: bigint | undefined },
): boolean {
	if (current.interval === BILLING_INTERVAL.YEAR && target.interval === BILLING_INTERVAL.MONTH) {
		return false;
	}
	if (
		current.interval === target.interval &&
		typeof current.amount === 'bigint' &&
		typeof target.amount === 'bigint' &&
		target.amount < current.amount
	) {
		return false;
	}
	if (typeof current.tier === 'number' && typeof target.tier === 'number' && current.tier !== target.tier) {
		return target.tier > current.tier;
	}
	return (
		current.plan === target.plan &&
		current.interval === BILLING_INTERVAL.MONTH &&
		target.interval === BILLING_INTERVAL.YEAR
	);
}

// Exhaustive by construction: a new BillingInterval fails compilation here
// instead of silently falling through to a default price.
function planPriceFor(plan: IBillingPlan, interval: BillingInterval): IBillingPlanPrice | undefined {
	switch (interval) {
		case BILLING_INTERVAL.MONTH:
			return plan.monthly;
		case BILLING_INTERVAL.YEAR:
			return plan.yearly;
		default: {
			const unhandled: never = interval;
			throw new Error(`[billing] unhandled billing interval: ${unhandled}`);
		}
	}
}

export function checkoutController(store: IStoreAdapter, config: IBillingConfig) {
	const plans = new PlanModel(store);
	const subscriptions = new SubscriptionModel(store);

	return {
		async createSession(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const planName = body?.['plan'];
			const interval = body?.['interval'] ?? BILLING_INTERVAL.MONTH;
			const subscriber = resolveSubscriber(ctx);

			if (typeof planName !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'plan is required');
			}
			if (!isBillingInterval(interval)) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					`interval must be one of: ${BILLING_INTERVALS.join(', ')}`,
				);
			}
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const plan = plans.findByNameInConfig(planName, config);
			if (!plan) {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', `Unknown plan: ${planName}`);
			}

			const pricing = planPriceFor(plan, interval);
			if (!pricing?.priceId) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					`Plan ${planName} does not support ${interval} billing`,
				);
			}

			// A member with a LIVE provider subscription (active / trialing /
			// past_due) may only UPGRADE in place — immediate, prorated charge. We
			// never open a second checkout against a live subscription, so anything
			// that isn't a clean upgrade is refused here rather than duplicated:
			//   - same plan AND interval → no-op (PLAN_UNCHANGED);
			//   - past_due → resolve the unpaid balance (or cancel) first;
			//   - scheduled to cancel → reactivate first (else the paid upgrade
			//     would still be deleted at period end);
			//   - a downgrade / non-upgrade → cancel, keep access to period end,
			//     then subscribe to the lower plan once membership is over.
			const current = await subscriptions.get(subscriber.type, subscriber.id);
			const LIVE = ['active', 'trialing', 'past_due'];
			if (current?.providerSubscriptionId && LIVE.includes(current.status)) {
				if (current.plan === planName && current.interval === interval) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'PLAN_UNCHANGED',
						`Already on ${planName} (${interval}); nothing to change.`,
					);
				}
				if (current.status === 'past_due') {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'SUBSCRIPTION_PAST_DUE',
						`There's an unpaid balance on your current plan. Resolve it (or cancel) before changing plans.`,
						{ reason: 'past_due', currentPlan: current.plan },
					);
				}
				if (current.cancelAtPeriodEnd) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'SUBSCRIPTION_SCHEDULED_TO_CANCEL',
						`Your ${current.plan} plan is scheduled to end. Reactivate it before changing plans.`,
						{ reason: 'scheduled_to_cancel', currentPlan: current.plan },
					);
				}
				const currentPlanCfg = plans.findByNameInConfig(current.plan, config);
				const currentPrice =
					current.interval === BILLING_INTERVAL.YEAR ? currentPlanCfg?.yearly : currentPlanCfg?.monthly;
				const upgrade = isClearUpgrade(
					{ plan: current.plan, interval: current.interval, tier: currentPlanCfg?.tier, amount: currentPrice?.amount },
					{ plan: planName, interval, tier: plan.tier, amount: pricing.amount },
				);
				if (!upgrade) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'PLAN_CHANGE_REQUIRES_CANCEL',
						`Moving to ${planName} isn't done in place. Cancel your current plan — you keep access until it ends — then subscribe to ${planName} once your current membership is over.`,
						{ reason: 'downgrade_requires_cancel', currentPlan: current.plan, targetPlan: planName },
					);
				}
				const res = await config.provider.updateSubscription({
					subscriptionId: current.providerSubscriptionId,
					priceId: pricing.priceId,
					prorationBehavior: 'always_invoice',
				});
				// Carry the trial + period forward (the shared upsert ASSIGNS these,
				// so omitting would null them). cancelAtPeriodEnd is forced false: we
				// only reach here when it was already false, and an upgrade is a
				// re-commitment, never a still-scheduled cancellation.
				const upsert: Parameters<typeof subscriptions.upsert>[0] = {
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					plan: planName,
					interval,
					status: res.status,
					providerSubscriptionId: current.providerSubscriptionId,
					cancelAtPeriodEnd: false,
					trialEndsAt: current.trialEndsAt,
				};
				if (current.providerCustomerId) upsert.providerCustomerId = current.providerCustomerId;
				const cps = res.currentPeriodStart ?? current.currentPeriodStart;
				if (cps) upsert.currentPeriodStart = cps;
				const cpe = res.currentPeriodEnd ?? current.currentPeriodEnd;
				if (cpe) upsert.currentPeriodEnd = cpe;
				await subscriptions.upsert(upsert);
				return setApiResponse(
					HTTP.OK,
					'SUBSCRIPTION_UPGRADED',
					'Subscription upgraded; the prorated difference was charged.',
					{ upgraded: true, plan: planName },
				);
			}

			// No live subscription (new, or a canceled/incomplete/unpaid prior one).
			// Reuse the subscriber's existing provider customer when present so the
			// saved card + wallet auto-recharge survive a resubscribe, instead of
			// orphaning it with a brand-new customer.
			const customerId =
				current?.providerCustomerId ??
				(
					await config.provider.createCustomer({
						email: ctx.user!.email ?? '',
						subscriberType: subscriber.type,
						subscriberId: subscriber.id,
						userId: ctx.user!.id,
					})
				).customerId;

			const sessionOpts: Parameters<typeof config.provider.createCheckoutSession>[0] = {
				customerId,
				priceId: pricing.priceId,
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				successUrl: config.successUrl,
				cancelUrl: config.cancelUrl,
			};
			if (plan.trialDays !== undefined) sessionOpts.trialDays = plan.trialDays;

			const { url } = await config.provider.createCheckoutSession(sessionOpts);

			await subscriptions.upsert({
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				plan: planName,
				interval,
				status: 'incomplete',
				providerCustomerId: customerId,
			});

			return setApiResponse(HTTP.OK, 'CHECKOUT_URL', 'Checkout session created.', { url });
		},

		async createPortal(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const subscription = await subscriptions.get(subscriber.type, subscriber.id);
			if (!subscription?.providerCustomerId) {
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No active subscription');
			}

			const { url } = await config.provider.createPortalSession({
				customerId: subscription.providerCustomerId,
				returnUrl: config.successUrl,
			});

			return setApiResponse(HTTP.OK, 'PORTAL_URL', 'Portal session created.', { url });
		},
	};
}
