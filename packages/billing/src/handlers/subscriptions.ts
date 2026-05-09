import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { getSubscription }   from '../services/subscriptions';
import { toSubscriptionDTO } from '../dtos/billing';

export function getSubscriptionHandler(store: IStoreAdapter) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401)
		}

		const params      = ctx.meta['params'] as Record<string, string> | undefined
		const workspaceId = ctx.workspace?.id ?? params?.['workspaceId']

		if (!workspaceId) {
			return setErrorResponse('WORKSPACE_REQUIRED', 'Workspace context required', 400)
		}

		const subscription = await getSubscription(workspaceId, store)
		if (!subscription) {
			return setErrorResponse('NOT_FOUND', 'No active subscription', 404)
		}

		return setApiResponse('SUBSCRIPTION_FETCHED', 'Subscription retrieved successfully.', { subscription: toSubscriptionDTO(subscription) })
	}
}
