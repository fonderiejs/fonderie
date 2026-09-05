import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig, BillingEventKey, BillingMessageKey } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { PriceCache } from '../services/price-cache';
import { SubscriptionModel } from '../models/subscription.model';
import { resolvePlanNameByPrice } from '../services/plans';
import { subscriberEventFields } from '../utils';
import { notifyBilling } from '../services/notify';
import { readWebhookEvent } from './webhook-shared';

// The lifecycle domain-event key for a subscription webhook. The verb reflects
// the resulting state: a deletion is a cancellation, an unpaid subscription is
// past_due, otherwise it's created vs. updated straight from the provider event.
function lifecycleEventKey(eventType: string, status: string): BillingEventKey {
	if (eventType === 'customer.subscription.deleted') return EVENT_KEYS.subscriptionCanceled;
	if (status === 'past_due') return EVENT_KEYS.subscriptionPastDue;
	if (eventType === 'customer.subscription.created') return EVENT_KEYS.subscriptionCreated;
	return EVENT_KEYS.subscriptionUpdated;
}

// The customer-facing notice for a subscription webhook, or null when none is
// warranted. Fires only on the transition INTO the state, so a provider
// re-delivery of the same status sends nothing: a cancellation confirms access
// is ending, a fresh past_due is the dunning notice.
function transitionNotice(
	eventType: string,
	status: string,
	priorStatus: string | null,
): BillingMessageKey | null {
	if (eventType === 'customer.subscription.deleted') {
		return priorStatus === 'canceled' ? null : MESSAGE_KEYS.subscriptionCanceled;
	}
	if (status === 'past_due' && priorStatus !== 'past_due') return MESSAGE_KEYS.paymentFailed;
	return null;
}

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
				// and double-apply).
				const key = lifecycleEventKey(event.type, event.subscription.status);
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

				// Customer-facing notice (§ Communication & Record Integrity).
				// Fire-and-forget inside notifyBilling.
				const messageKey = transitionNotice(event.type, event.subscription.status, priorStatus);
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
