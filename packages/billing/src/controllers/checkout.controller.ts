import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { PlanModel } from '../models/plan.model';
import { SubscriptionModel } from '../models/subscription.model';
import { resolveSubscriber } from '../utils';

export function checkoutController(store: IStoreAdapter, config: IBillingConfig) {
	const plans = new PlanModel(store);
	const subscriptions = new SubscriptionModel(store);

	return {
		async createSession(ctx: IFonderieContext): Promise<Response> {
			const body = ctx.meta['body'] as Record<string, unknown> | undefined;
			const planName = body?.['plan'];
			const interval = (body?.['interval'] ?? 'month') as 'month' | 'year';
			const subscriber = resolveSubscriber(ctx);

			if (typeof planName !== 'string') {
				return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'plan is required');
			}
			if (interval !== 'month' && interval !== 'year') {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					'interval must be month or year',
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

			const pricing = interval === 'year' ? plan.yearly : plan.monthly;
			if (!pricing?.priceId) {
				return setApiResponse(
					HTTP.UNPROCESSABLE,
					'INVALID_PARAMETER',
					`Plan ${planName} does not support ${interval} billing`,
				);
			}

			// If there's already an active subscription: allow upgrades only, and
			// change the subscription in place (proration) rather than opening a
			// second checkout / creating a duplicate subscription.
			const current = await subscriptions.get(subscriber.type, subscriber.id);
			const ACTIVE = ['active', 'trialing', 'past_due'];
			if (current && ACTIVE.includes(current.status)) {
				const currentTier = plans.findByNameInConfig(current.plan, config)?.tier ?? -1;
				const targetTier = plan.tier ?? -1;
				if (targetTier <= currentTier) {
					return setApiResponse(
						HTTP.UNPROCESSABLE,
						'DOWNGRADE_NOT_ALLOWED',
						`Cannot switch from ${current.plan} to a same-or-lower tier (${planName}) mid-cycle. Upgrades only.`,
					);
				}
				if (current.providerSubscriptionId) {
					const res = await config.provider.updateSubscription({
						subscriptionId: current.providerSubscriptionId,
						priceId: pricing.priceId,
					});
					const upsert: Parameters<typeof subscriptions.upsert>[0] = {
						subscriberType: subscriber.type,
						subscriberId: subscriber.id,
						plan: planName,
						interval,
						status: res.status,
						providerSubscriptionId: current.providerSubscriptionId,
					};
					if (current.providerCustomerId) upsert.providerCustomerId = current.providerCustomerId;
					if (res.currentPeriodStart) upsert.currentPeriodStart = res.currentPeriodStart;
					if (res.currentPeriodEnd) upsert.currentPeriodEnd = res.currentPeriodEnd;
					await subscriptions.upsert(upsert);
					return setApiResponse(
						HTTP.OK,
						'SUBSCRIPTION_UPGRADED',
						'Subscription upgraded; the prorated difference was charged.',
						{ upgraded: true, plan: planName },
					);
				}
			}

			const { customerId } = await config.provider.createCustomer({
				email: ctx.user!.email ?? '',
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				userId: ctx.user!.id,
			});

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
