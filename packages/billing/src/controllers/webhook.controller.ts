import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { PriceCache } from '../services/price-cache';
import { SubscriptionModel } from '../models/subscription.model';
import { resolvePlanNameByPrice } from '../services/plans';
import { subscriberEventFields } from '../utils';
import { notifyBilling } from '../services/notify';
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

				// Prior status BEFORE the upsert overwrites it — the customer-facing
				// notification below fires only on the transition INTO canceled /
				// past_due. Providers re-deliver the same event (and keep a
				// subscription past_due across retries); the durable domain event
				// fires every time, but a human should not be re-emailed each retry.
				const priorStatus = (
					await subscriptions.get(
						event.subscription.subscriberType,
						event.subscription.subscriberId,
					)
				)?.status ?? null;

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

				// Customer-facing notice (§ Communication & Record Integrity), only
				// on the transition into the state so provider retries don't re-email.
				// A failed payment (past_due) is the dunning notice; a cancellation
				// confirms access is ending. Fire-and-forget inside notifyBilling.
				const canceled = event.type === 'customer.subscription.deleted';
				const messageKey = canceled
					? priorStatus !== 'canceled'
						? MESSAGE_KEYS.subscriptionCanceled
						: null
					: event.subscription.status === 'past_due' && priorStatus !== 'past_due'
						? MESSAGE_KEYS.paymentFailed
						: null;
				if (messageKey) {
					void notifyBilling(bus, config, {
						subscriberType: event.subscription.subscriberType,
						subscriberId: event.subscription.subscriberId,
						type: messageKey,
						data: {
							plan,
							status: event.subscription.status,
							interval: event.subscription.interval,
							providerSubscriptionId: event.subscription.providerSubscriptionId,
						},
					});
				}
			}

			return Response.json({ received: true });
		},
	};
}
