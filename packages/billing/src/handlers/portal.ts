import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';

import { getSubscription }       from '../services/subscriptions';

export function createPortalHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'] ??
			ctx.request.headers.get('x-workspace-id');

		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 });
		}

		const subscription = await getSubscription(workspaceId, store);
		if (!subscription?.providerCustomerId) {
			return Response.json({ error: 'No active subscription' }, { status: 404 });
		}

		const { url } = await config.provider.createPortalSession({
			customerId: subscription.providerCustomerId,
			returnUrl:  config.successUrl,
		});

		return Response.json({ url }, { status: 200 });
	}
}
