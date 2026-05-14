import { setApiResponse, HTTP } from '@fonderie-js/core';
import type { IFonderieContext } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import { SubscriptionModel } from '../models/subscription.model';
import { toSubscriptionDTO } from '../dtos/billing';
import { resolveSubscriber } from '../utils';

export function subscriptionController(store: IStoreAdapter) {
	const subscriptions = new SubscriptionModel(store);

	return {
		async get(ctx: IFonderieContext): Promise<Response> {
			const subscriber = resolveSubscriber(ctx);
			if (!subscriber) {
				return setApiResponse(
					HTTP.BAD_REQUEST,
					'SUBSCRIBER_REQUIRED',
					'Subscriber context required',
				);
			}

			const subscription = await subscriptions.get(subscriber.type, subscriber.id);
			if (!subscription)
				return setApiResponse(HTTP.NOT_FOUND, 'NOT_FOUND', 'No active subscription');

			return setApiResponse(
				HTTP.OK,
				'SUBSCRIPTION_FETCHED',
				'Subscription retrieved successfully.',
				{
					subscription: toSubscriptionDTO(subscription),
				},
			);
		},
	};
}
