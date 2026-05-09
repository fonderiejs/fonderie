import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';

import { getSubscription }       from '../services/subscriptions';

export function createPortalHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse('UNAUTHORIZED', 'Unauthorized', 401);
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'] ??
			ctx.request.headers.get('x-workspace-id');

		if (!workspaceId) {
			return setErrorResponse('WORKSPACE_REQUIRED', 'Workspace context required', 400);
		}

		const subscription = await getSubscription(workspaceId, store);
		if (!subscription?.providerCustomerId) {
			return setErrorResponse('NOT_FOUND', 'No active subscription', 404);
		}

		const { url } = await config.provider.createPortalSession({
			customerId: subscription.providerCustomerId,
			returnUrl:  config.successUrl,
		});

		return setApiResponse('PORTAL_URL', 'Portal session created.', { url });
	}
}
