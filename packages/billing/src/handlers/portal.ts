import { setApiResponse, setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext }             from '@fonderie-js/core';
import type { IStoreAdapter }               from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';

import { getSubscription }       from '../services/subscriptions';

export function createPortalHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!ctx.user) {
			return setErrorResponse(401, 'UNAUTHORIZED', 'Unauthorized');
		}

		const workspaceId = ctx.workspace?.id ??
			(ctx.meta['params'] as Record<string, string> | undefined)?.['workspaceId'] ??
			ctx.request.headers.get('x-workspace-id');

		if (!workspaceId) {
			return setErrorResponse(400, 'WORKSPACE_REQUIRED', 'Workspace context required');
		}

		const subscription = await getSubscription(workspaceId, store);
		if (!subscription?.providerCustomerId) {
			return setErrorResponse(404, 'NOT_FOUND', 'No active subscription');
		}

		const { url } = await config.provider.createPortalSession({
			customerId: subscription.providerCustomerId,
			returnUrl:  config.successUrl,
		});

		return setApiResponse(200, 'PORTAL_URL', 'Portal session created.', { url });
	}
}
