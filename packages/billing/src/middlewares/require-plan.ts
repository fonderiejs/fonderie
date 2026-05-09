import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { Middleware }     from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }  from '@fonderie-js/store';

import { getSubscription }    from '../services/subscriptions';

// Gates a route behind a minimum plan
// Usage: requirePlan(['pro', 'enterprise'], store)

function makeHandler(plans: string | string[], store: IStoreAdapter): Middleware {
	const allowed = Array.isArray(plans) ? plans : [plans];

	return async (ctx, next) => {
		if (!ctx.user) {
			return setApiResponse(HTTP.UNAUTHORIZED, 'UNAUTHORIZED', 'Unauthorized');
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId']

		if (!workspaceId) {
			return setApiResponse(HTTP.BAD_REQUEST, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		const subscription = await getSubscription(workspaceId, store);

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
	}
}

export function requirePlan(plans: string | string[], store: IStoreAdapter): Middleware
export function requirePlan(plans: string | string[], store: IStoreAdapter, ctx: IFonderieContext, next: () => Promise<Response>): Promise<Response>
export function requirePlan(
	plans: string | string[],
	store: IStoreAdapter,
	ctx?:  IFonderieContext,
	next?: () => Promise<Response>,
): Middleware | Promise<Response> {
	const handler = makeHandler(plans, store)
	if (ctx !== undefined && next !== undefined) return handler(ctx, next)
	return handler
}
