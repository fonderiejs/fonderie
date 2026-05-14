import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import type { IBillingConfig } from '../config';
import { SubscriptionModel } from '../models/subscription.model';

export function webhookController(store: IStoreAdapter, config: IBillingConfig) {
	const subscriptions = new SubscriptionModel(store);

	return {
		async handle(ctx: IFonderieContext): Promise<Response> {
			if (!config.webhookSecret) {
				return setApiResponse(HTTP.SERVER_ERROR, 'SERVER_ERROR', 'Webhook secret not configured');
			}

			const signature =
				ctx.request.headers.get('stripe-signature') ??
				ctx.request.headers.get('paypal-auth-algo') ??
				'';

			if (!signature) {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Missing webhook signature');
			}

			const payload = await ctx.request.text();

			let event: Awaited<ReturnType<typeof config.provider.constructEvent>>;
			try {
				event = await config.provider.constructEvent({
					payload,
					signature,
					secret: config.webhookSecret,
				});
			} catch {
				return setApiResponse(HTTP.BAD_REQUEST, 'INVALID_REQUEST', 'Invalid webhook signature');
			}

			if (event.subscription) {
				await subscriptions.upsert({
					subscriberType: event.subscription.subscriberType,
					subscriberId: event.subscription.subscriberId,
					plan: event.subscription.plan,
					status: event.subscription.status,
					providerCustomerId: event.subscription.providerCustomerId,
					providerSubscriptionId: event.subscription.providerSubscriptionId,
					currentPeriodStart: event.subscription.currentPeriodStart,
					currentPeriodEnd: event.subscription.currentPeriodEnd,
					cancelAtPeriodEnd: event.subscription.cancelAtPeriodEnd,
					trialEndsAt: event.subscription.trialEndsAt,
				});
			}

			return Response.json({ received: true });
		},
	};
}
