import type { Middleware }    from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

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
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId']

		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		const subscription = await getSubscription(workspaceId, store);

		if (!subscription || !allowed.includes(subscription.plan)) {
			return Response.json(
				{
					error:    'Plan upgrade required',
					required: allowed,
					current:  subscription?.plan ?? 'none',
				},
				{ status: 402 },
			);
		}

		if (subscription.status !== 'active' && subscription.status !== 'trialing') {
			return Response.json(
				{ error: 'Subscription is not active', status: subscription.status },
				{ status: 402 },
			);
		}

		return next();
	}
}
