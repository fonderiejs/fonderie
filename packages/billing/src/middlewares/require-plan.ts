import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { getSubscription, isWithinDunningGrace } from '../services/subscriptions';
import { resolveSubscriber } from '../utils';

// Gates a route behind a minimum plan.
// Works for both user-level and workspace-level subscriptions.
// Usage: requirePlan(['pro', 'enterprise'], store)
// Dunning grace (opt-in): requirePlan(['pro'], store, { graceDays: 3 }) keeps a
// past_due subscriber inside the grace window authorized (mirrors withBilling).

export interface IRequirePlanOptions {
	graceDays?: number;
}

function makeHandler(
	plans: string | string[],
	store: IStoreAdapter,
	opts: IRequirePlanOptions = {},
): Middleware {
	const allowed = Array.isArray(plans) ? plans : [plans];

	return async (ctx, next) => {
		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}

		const subscriber = resolveSubscriber(ctx);
		if (!subscriber) {
			return setApiResponse(HTTP.BAD_REQUEST, 'SUBSCRIBER_REQUIRED', 'Subscriber context required');
		}

		const subscription = await getSubscription(subscriber.type, subscriber.id, store);

		if (!subscription || !allowed.includes(subscription.plan)) {
			return setApiResponse(
				HTTP.PAYMENT_REQUIRED,
				'PLAN_UPGRADE_REQUIRED',
				'Plan upgrade required',
				{ required: allowed, current: subscription?.plan ?? 'none' },
			);
		}

		const active =
			subscription.status === 'active' ||
			subscription.status === 'trialing' ||
			isWithinDunningGrace(subscription, opts.graceDays);
		if (!active) {
			return setApiResponse(
				HTTP.PAYMENT_REQUIRED,
				'SUBSCRIPTION_INACTIVE',
				'Subscription is not active',
				{ status: subscription.status },
			);
		}

		return next();
	};
}

export function requirePlan(plans: string | string[], store: IStoreAdapter): Middleware;
export function requirePlan(
	plans: string | string[],
	store: IStoreAdapter,
	opts: IRequirePlanOptions,
): Middleware;
export function requirePlan(
	plans: string | string[],
	store: IStoreAdapter,
	ctx: IFonderieContext,
	next: () => Promise<Response>,
): Promise<Response>;
export function requirePlan(
	plans: string | string[],
	store: IStoreAdapter,
	arg3?: IFonderieContext | IRequirePlanOptions,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	// Direct-call form passes both ctx AND next; the factory form passes at most
	// an options object as arg3.
	if (next !== undefined) return makeHandler(plans, store)(arg3 as IFonderieContext, next);
	return makeHandler(plans, store, (arg3 as IRequirePlanOptions) ?? {});
}
