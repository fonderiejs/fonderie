import { setApiResponse, HTTP } from '@fonderie/core';
import type { Middleware } from '@fonderie/core';
import type { IFonderieContext } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { getSubscription } from '../services/subscriptions';
import { resolveSubscriber } from '../utils';

// Gates a route behind a minimum plan.
// Works for both user-level and workspace-level subscriptions.
// Usage: requirePlan(['pro', 'enterprise'], store)

function makeHandler(plans: string | string[], store: IStoreAdapter): Middleware {
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

		if (subscription.status !== 'active' && subscription.status !== 'trialing') {
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
	ctx: IFonderieContext,
	next: () => Promise<Response>,
): Promise<Response>;
export function requirePlan(
	plans: string | string[],
	store: IStoreAdapter,
	ctx?: IFonderieContext,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	const handler = makeHandler(plans, store);
	if (ctx !== undefined && next !== undefined) return handler(ctx, next);
	return handler;
}
