import { setErrorResponse }    from '@fonderie-js/core';
import type { Middleware }     from '@fonderie-js/core';
import type { IStoreAdapter }  from '@fonderie-js/store';

import { getSubscription }    from '../services/subscriptions';

// Gates a route behind a minimum plan
// Usage: requirePlan(['pro', 'enterprise'], store)

export function requirePlan(
	plans: string | string[],
	store: IStoreAdapter,
): Middleware {
	const allowed = Array.isArray(plans) ? plans : [plans];

	return async (ctx, next) => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId']

		if (!workspaceId) {
			return setErrorResponse('WORKSPACE_REQUIRED', 'Workspace context required', 400);
		}

		const subscription = await getSubscription(workspaceId, store);

		if (!subscription || !allowed.includes(subscription.plan)) {
			return setErrorResponse(
				'PLAN_UPGRADE_REQUIRED',
				'Plan upgrade required',
				402,
				{ required: allowed, current: subscription?.plan ?? 'none' },
			);
		}

		if (subscription.status !== 'active' && subscription.status !== 'trialing') {
			return setErrorResponse(
				'SUBSCRIPTION_INACTIVE',
				'Subscription is not active',
				402,
				{ status: subscription.status },
			);
		}

		return next();
	}
}
