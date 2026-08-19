import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import type { PriceCache } from '../services/price-cache';
import { SubscriptionModel } from '../models/subscription.model';
import { resolvePlanNameByPrice } from '../services/plans';

export function webhookController(store: IStoreAdapter, config: IBillingConfig, priceCache?: PriceCache) {
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

			// §8: keep the price cache honest. Invalidate on any price/product change
			// regardless of arrival order (invalidate-and-refetch is order-safe).
			if (priceCache && (event.type.startsWith('price.') || event.type.startsWith('product.'))) {
				priceCache.invalidate();
			}

			if (event.subscription) {
				// A deletion resolves to the free/canceled state set by the provider;
				// otherwise map the plan from the price (dual-mapping), falling back to
				// the nickname-derived value.
				const plan =
					event.type === 'customer.subscription.deleted'
						? event.subscription.plan
						: resolvePlanNameByPrice(event.subscription, config.plans) ?? event.subscription.plan;

				await subscriptions.upsert({
					subscriberType: event.subscription.subscriberType,
					subscriberId: event.subscription.subscriberId,
					plan,
					interval: event.subscription.interval,
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
