import { setApiResponse, HTTP } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IBillingConfig } from '../config';
import { SubscriptionModel } from '../models/subscription.model';
import { toSubscriptionDTO } from '../dtos/billing';
import { resolveSubscriber } from '../utils';

export function subscriptionController(store: IStoreAdapter, config: IBillingConfig) {
	const subscriptions = new SubscriptionModel(store);

	// Shared preamble for the mutating routes: resolve the subscriber and their
	// current subscription, or return the appropriate error Response.
	async function requireSubscription(ctx: IFonderieContext) {
		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) {
			return {
				error: setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required'),
			};
		}
		const current = await subscriptions.get(subscriber.type, subscriber.id);
		if (!current?.providerSubscriptionId) {
			return { error: setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No active subscription') };
		}
		return { subscriber, current, providerSubscriptionId: current.providerSubscriptionId };
	}

	return {
		async get(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const subscription = await subscriptions.get(subscriber.type, subscriber.id);
			if (!subscription)
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No active subscription');

			return setApiResponse(
				HTTP.OK,
				'SUBSCRIPTION_FETCHED',
				'Subscription retrieved successfully.',
				{
					subscription: toSubscriptionDTO(subscription),
				},
			);
		},

		// First-party cancel. Default (atPeriodEnd:true) keeps access until the
		// paid-through date; atPeriodEnd:false ends it immediately. The stored row
		// is updated optimistically for an immediate read-back; the provider's
		// webhook is the source of truth for the lifecycle event + customer notice
		// (so cancellation is announced exactly once, from one place).
		async cancel(ctx: IFonderieContext): Promise<Response> {
			if (typeof config.provider.cancelSubscription !== 'function') {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'CANCEL_NOT_SUPPORTED',
					`Provider '${config.provider.name}' does not support first-party cancellation`,
				);
			}
			const resolved = await requireSubscription(ctx);
			if ('error' in resolved) return resolved.error;
			const { subscriber, current, providerSubscriptionId } = resolved;

			// Already terminal — no-op, don't re-hit the provider (which would
			// reject updating a canceled subscription) or re-announce.
			if (current.status === 'canceled') {
				return setApiResponse(HTTP.OK, 'SUBSCRIPTION_CANCELED', 'Subscription is already canceled.', {
					atPeriodEnd: current.cancelAtPeriodEnd ?? false,
					status: current.status,
					currentPeriodEnd: current.currentPeriodEnd
						? new Date(current.currentPeriodEnd).toISOString()
						: null,
				});
			}

			const body = ctx.meta['body'] as { atPeriodEnd?: boolean } | undefined;
			const atPeriodEnd = body?.atPeriodEnd ?? true;

			const res = await config.provider.cancelSubscription({
				subscriptionId: providerSubscriptionId,
				atPeriodEnd,
			});

			// Optimistic stored-state update ONLY for at-period-end: it writes a
			// non-terminal status (active/trialing) + the cancelAtPeriodEnd flag,
			// which does not collide with the webhook's canceled-transition dedup.
			// For an IMMEDIATE cancel we deliberately do NOT write status='canceled'
			// here — that would make the customer.subscription.deleted webhook
			// mistake its first delivery for a re-delivery (priorStatus already
			// 'canceled') and SUPPRESS the single cancellation notice. The deleted
			// webhook owns that transition + notice; the 200 below confirms to the
			// caller. Carry period/trial fields forward so the row isn't nulled
			// (the shared upsert SQL assigns, not COALESCEs, those columns).
			if (atPeriodEnd) {
				const upsert: Parameters<typeof subscriptions.upsert>[0] = {
					subscriberType: subscriber.type,
					subscriberId: subscriber.id,
					plan: current.plan,
					interval: current.interval,
					status: res.status,
					providerSubscriptionId,
					cancelAtPeriodEnd: res.cancelAtPeriodEnd,
					trialEndsAt: current.trialEndsAt,
				};
				if (current.providerCustomerId) upsert.providerCustomerId = current.providerCustomerId;
				if (current.currentPeriodStart) upsert.currentPeriodStart = current.currentPeriodStart;
				const cpe = res.currentPeriodEnd ?? current.currentPeriodEnd;
				if (cpe) upsert.currentPeriodEnd = cpe;
				await subscriptions.upsert(upsert);
			}

			return setApiResponse(
				HTTP.OK,
				'SUBSCRIPTION_CANCELED',
				atPeriodEnd
					? 'Subscription will cancel at the end of the current period.'
					: 'Subscription canceled.',
				{
					atPeriodEnd: res.cancelAtPeriodEnd,
					status: res.status,
					currentPeriodEnd: res.currentPeriodEnd ? res.currentPeriodEnd.toISOString() : null,
				},
			);
		},

		// Un-cancel a subscription scheduled to cancel at period end. Idempotent:
		// reactivating an already-active subscription is a no-op that still returns
		// 200. Events/notices, if any, come from the provider webhook.
		async reactivate(ctx: IFonderieContext): Promise<Response> {
			if (typeof config.provider.reactivateSubscription !== 'function') {
				return setApiResponse(
					HTTP.NOT_IMPLEMENTED,
					'REACTIVATE_NOT_SUPPORTED',
					`Provider '${config.provider.name}' does not support reactivation`,
				);
			}
			const resolved = await requireSubscription(ctx);
			if ('error' in resolved) return resolved.error;
			const { subscriber, current, providerSubscriptionId } = resolved;

			// A fully-canceled subscription can't be un-canceled — the provider
			// rejects updating a canceled subscription. The customer re-subscribes.
			if (current.status === 'canceled') {
				return setApiResponse(
					HTTP.CONFLICT,
					'SUBSCRIPTION_CANCELED',
					'A canceled subscription cannot be reactivated; start a new checkout.',
				);
			}

			const res = await config.provider.reactivateSubscription({
				subscriptionId: providerSubscriptionId,
			});

			// Carry period/trial fields forward so the optimistic write doesn't
			// null them (the shared upsert SQL assigns, not COALESCEs, those).
			const upsert: Parameters<typeof subscriptions.upsert>[0] = {
				subscriberType: subscriber.type,
				subscriberId: subscriber.id,
				plan: current.plan,
				interval: current.interval,
				status: res.status,
				providerSubscriptionId,
				cancelAtPeriodEnd: res.cancelAtPeriodEnd,
				trialEndsAt: current.trialEndsAt,
			};
			if (current.providerCustomerId) upsert.providerCustomerId = current.providerCustomerId;
			if (current.currentPeriodStart) upsert.currentPeriodStart = current.currentPeriodStart;
			const cpe = res.currentPeriodEnd ?? current.currentPeriodEnd;
			if (cpe) upsert.currentPeriodEnd = cpe;
			await subscriptions.upsert(upsert);

			return setApiResponse(HTTP.OK, 'SUBSCRIPTION_REACTIVATED', 'Subscription reactivated.', {
				status: res.status,
				cancelAtPeriodEnd: res.cancelAtPeriodEnd,
			});
		},
	};
}
