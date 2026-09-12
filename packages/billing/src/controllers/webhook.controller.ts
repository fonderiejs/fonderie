import { setApiResponse, HTTP, background } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig, BillingEventKey, BillingMessageKey } from '../config';
import { EVENT_KEYS, MESSAGE_KEYS } from '../config';
import type { PriceCache } from '../services/price-cache';
import { SubscriptionModel } from '../models/subscription.model';
import { getSubscriberByProviderSubscriptionId } from '../services/subscriptions';
import { resolvePlanNameByPrice } from '../services/plans';
import { applyPackCredit } from '../services/purchase';
import { normalizeCurrency, subscriberEventFields } from '../utils';
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

			// A trial about to end — a heads-up notice + domain event WITHOUT
			// mutating subscription state (nothing has changed yet). Checked before
			// the generic subscription-upsert path, which this event also feeds.
			if (event.type === 'customer.subscription.trial_will_end' && event.subscription) {
				const s = event.subscription;
				// Resolve the config plan name the same way every other lifecycle
				// path does — the normalized `plan` is only the price nickname (or
				// 'unknown' when nickname is unset, the recommended config), so
				// using it raw would email "your unknown plan trial is ending".
				const plan = resolvePlanNameByPrice(s, config.plans) ?? s.plan;
				const trialEndsAt = s.trialEndsAt ? s.trialEndsAt.toISOString() : null;
				await background(bus
					?.emit(EVENT_KEYS.subscriptionTrialWillEnd, {
						...subscriberEventFields(s.subscriberType, s.subscriberId),
						plan,
						interval: s.interval,
						trialEndsAt,
						providerSubscriptionId: s.providerSubscriptionId,
					}));
				// The durable domain event always fires; the reminder EMAIL is
				// opt-out via config.notifications.trialEnding (default on).
				if (config.notifications?.trialEnding !== false) {
					void notifyBilling(bus, config, {
						subscriberType: s.subscriberType,
						subscriberId: s.subscriberId,
						type: MESSAGE_KEYS.trialEnding,
						data: { plan, trialEndsAt },
					});
				}
				return Response.json({ received: true });
			}

			// Subscription invoice events (Phase 3b). A paid renewal → a receipt; a
			// failed renewal → a durable domain event ONLY (the dunning EMAIL fires
			// once on the past_due transition below, so emailing here too would
			// double-dun). The invoice carries the provider subscription, not our
			// subscriber identity, so resolve it.
			if (event.invoice) {
				const inv = event.invoice;

				// In-app pack-purchase invoice (metadata.reason==='purchase') — the
				// orphan safety-net: heal-credit the wallet if the synchronous purchase
				// credit was lost to an indeterminate outcome. Idempotent on the
				// invoice's PaymentIntent — the SAME key applyPackCredit uses in the
				// synchronous path — so a normal (already-credited) purchase's
				// invoice.paid no-ops and this can never double-credit. These invoices
				// carry no subscription id, so they'd otherwise fall through below.
				if (inv.status === 'paid' && inv.metadata['reason'] === 'purchase') {
					const st = inv.metadata['subscriberType'];
					const sid = inv.metadata['subscriberId'];
					const packId = inv.metadata['packId'];
					const credits = inv.metadata['credits'] ?? '';
					if (
						(st === 'user' || st === 'workspace') &&
						sid &&
						packId &&
						/^\d{1,30}$/.test(credits) &&
						inv.providerTxId
					) {
						const creditCurrency = normalizeCurrency(
							inv.metadata['currency'] ?? config.wallet?.currency ?? 'USD',
						);
						await applyPackCredit({
							store,
							config,
							bus,
							subscriberType: st,
							subscriberId: sid,
							creditCurrency,
							precision: config.wallet?.precision ?? 2,
							credits: BigInt(credits),
							packId,
							providerTxId: inv.providerTxId,
							amountPaid: inv.amount ?? 0n,
							paymentCurrency: inv.currency ?? creditCurrency,
						});
						return Response.json({ received: true });
					}
					// Ours (reason:purchase) but malformed — surface so the provider flags it.
					return setApiResponse(HTTP.UNPROCESSABLE, 'INVALID_PARAMETER', 'Malformed pack invoice metadata');
				}

				const subscriber = inv.providerSubscriptionId
					? await getSubscriberByProviderSubscriptionId(inv.providerSubscriptionId, store)
					: null;
				if (!subscriber) return Response.json({ received: true, ignored: 'no-matching-subscription' });
				const fields = {
					...subscriberEventFields(subscriber.subscriberType, subscriber.subscriberId),
					invoiceId: inv.id,
					amount: inv.amount?.toString() ?? null,
					currency: inv.currency,
					providerSubscriptionId: inv.providerSubscriptionId,
				};
				if (inv.status === 'paid') {
					await background(bus?.emit(EVENT_KEYS.invoicePaid, fields));
					void notifyBilling(bus, config, {
						subscriberType: subscriber.subscriberType,
						subscriberId: subscriber.subscriberId,
						type: MESSAGE_KEYS.renewalReceipt,
						data: { invoiceId: inv.id, amount: inv.amount?.toString() ?? null, currency: inv.currency },
					});
				} else {
					await background(bus?.emit(EVENT_KEYS.invoicePaymentFailed, fields));
				}
				return Response.json({ received: true });
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

				const applied = await subscriptions.upsert({
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
					// Ordering key: a stale/out-of-order retry no-ops the upsert.
					providerEventAt: event.eventAt ?? null,
				});

				// The ordering guard rejected this event as stale — the stored row is
				// correctly unchanged. Skip the lifecycle event + customer notice too:
				// firing them would let a downstream consumer act on stale state (e.g.
				// re-grant access on a subscriptionUpdated:active that arrived after the
				// cancellation), resurrecting the subscription via the event bus.
				if (!applied) {
					return Response.json({ received: true, ignored: 'stale-subscription-event' });
				}

				// Durably record a consumed trial so a later cancel → resubscribe can't
				// farm a fresh one (checkout consults this before applying trialDays).
				// Idempotent; awaited so a transient failure retries with the webhook
				// rather than silently leaving the subscriber trial-eligible again.
				if (event.subscription.trialEndsAt) {
					await subscriptions.markTrialConsumed(
						event.subscription.subscriberType,
						event.subscription.subscriberId,
					);
				}

				// Publish the lifecycle domain event. Fire-and-forget: a bus
				// hiccup must never fail the webhook (the provider would retry
				// and double-apply).
				const key = lifecycleEventKey(event.type, event.subscription.status);
				await background(bus
					?.emit(key, {
						...subscriberEventFields(
							event.subscription.subscriberType,
							event.subscription.subscriberId,
						),
						plan,
						status: event.subscription.status,
						interval: event.subscription.interval,
						providerSubscriptionId: event.subscription.providerSubscriptionId,
					}));

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
