import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS } from '../config';
import type { PriceCache } from '../services/price-cache';
import { SubscriptionModel } from '../models/subscription.model';
import { resolvePlanNameByPrice } from '../services/plans';
import { subscriberEventFields } from '../utils';
import { readWebhookEvent } from './webhook-shared';

export function webhookController(
	store: IStoreAdapter,
	config: IBillingConfig,
	priceCache?: PriceCache,
	bus?: EventBus,
) {
	const subscriptions = new SubscriptionModel(store);

	return {
		async handle(ctx: IFonderieContext): Promise<Response> {
			const event = await readWebhookEvent(
				ctx,
				config.webhookSecret,
				config.provider,
				'Webhook secret not configured',
			);
			if (event instanceof Response) return event;

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

				// Publish the lifecycle domain event. Fire-and-forget: a bus
				// hiccup must never fail the webhook (the provider would retry
				// and double-apply). The verb reflects the resulting state:
				// deletion → canceled, past_due → past_due, created vs updated
				// from the provider event type.
				const key =
					event.type === 'customer.subscription.deleted'
						? EVENT_KEYS.subscriptionCanceled
						: event.subscription.status === 'past_due'
							? EVENT_KEYS.subscriptionPastDue
							: event.type === 'customer.subscription.created'
								? EVENT_KEYS.subscriptionCreated
								: EVENT_KEYS.subscriptionUpdated;
				bus
					?.emit(key, {
						...subscriberEventFields(
							event.subscription.subscriberType,
							event.subscription.subscriberId,
						),
						plan,
						status: event.subscription.status,
						interval: event.subscription.interval,
						providerSubscriptionId: event.subscription.providerSubscriptionId,
					})
					.catch(() => {});
			}

			return Response.json({ received: true });
		},
	};
}
