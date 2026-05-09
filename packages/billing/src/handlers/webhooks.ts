import { setErrorResponse } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';

import { upsertSubscription }    from '../services/subscriptions';

export function webhookHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!config.webhookSecret) {
			return setErrorResponse(500, 'SERVER_ERROR', 'Webhook secret not configured');
		}

		const signature = ctx.request.headers.get('stripe-signature')
			?? ctx.request.headers.get('paypal-auth-algo')
			?? '';

		if (!signature) {
			return setErrorResponse(400, 'INVALID_REQUEST', 'Missing webhook signature');
		}

		const payload = await ctx.request.text();

		let event: Awaited<ReturnType<typeof config.provider.constructEvent>>
		try {
			event = await config.provider.constructEvent({
				payload,
				signature,
				secret: config.webhookSecret,
			});
		} catch {
			return setErrorResponse(400, 'INVALID_REQUEST', 'Invalid webhook signature');
		}

		if (event.subscription) {
			await upsertSubscription(
				{
					workspaceId:             event.subscription.workspaceId,
					plan:                    event.subscription.plan,
					status:                  event.subscription.status,
					providerCustomerId:      event.subscription.providerCustomerId,
					providerSubscriptionId:  event.subscription.providerSubscriptionId,
					currentPeriodStart:      event.subscription.currentPeriodStart,
					currentPeriodEnd:        event.subscription.currentPeriodEnd,
					cancelAtPeriodEnd:       event.subscription.cancelAtPeriodEnd,
					trialEndsAt:             event.subscription.trialEndsAt,
				},
				store,
			);
		}

		return Response.json({ received: true });
	}
}
