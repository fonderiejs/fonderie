import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import { getSubscription }  from '../services/subscriptions';
import { toSubscriptionDTO } from '../dtos/billing';

export function getSubscriptionHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId = ctx.workspace?.id ?? params?.['workspaceId']

		if (!workspaceId) {
			return Response.json({ error: 'Workspace context required' }, { status: 400 })
		}

		const subscription = await getSubscription(workspaceId, store)
		if (!subscription) {
			return Response.json({ error: 'No active subscription' }, { status: 404 })
		}

		return Response.json({ subscription: toSubscriptionDTO(subscription) })
	}
}
