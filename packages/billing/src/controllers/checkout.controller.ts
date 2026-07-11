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
