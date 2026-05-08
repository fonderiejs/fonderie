import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter }    from '@fonderie-js/store';

import type { IBillingConfig }   from '../config';

import { upsertSubscription }    from '../services/subscriptions';

export function webhookHandler(store: IStoreAdapter, config: IBillingConfig) {
	return async (ctx: IFonderieContext): Promise<Response> => {
		if (!config.webhookSecret) {
			return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
		}

		const signature = ctx.request.headers.get('stripe-signature')
			?? ctx.request.headers.get('paypal-auth-algo')  // PayPal uses a different header
			?? '';

		if (!signature) {
			return Response.json({ error: 'Missing webhook signature' }, { status: 400 });
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
			return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
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
