import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import { SubscriptionModel } from '../models/subscription.model';
import { toSubscriptionDTO } from '../dtos/billing';

export function subscriptionController(store: IStoreAdapter) {
	const subscriptions = new SubscriptionModel(store)

	return {
		async get(ctx: IFonderieContext): Promise<Response> {
			if (!ctx.user) return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized')

			const params      = ctx.meta['params'] as Record<string, string> | undefined
			const workspaceId = ctx.workspace?.id ?? params?.['workspaceId']

			if (!workspaceId) {
				return setErrorResponse(400, 'WORKSPACE_REQUIRED', 'Workspace context required')
			}

			const subscription = await subscriptions.get(workspaceId)
			if (!subscription) return setErrorResponse(404, 'NOT_FOUND', 'No active subscription')

			return setApiResponse(200, 'SUBSCRIPTION_FETCHED', 'Subscription retrieved successfully.', {
				subscription: toSubscriptionDTO(subscription),
			})
		},
	}
}
