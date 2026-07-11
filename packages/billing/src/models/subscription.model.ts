import type { IStoreAdapter } from '@fonderie/store';

import type { ISubscription, SubscriberType } from '../types';
import { getSubscription, upsertSubscription } from '../services/subscriptions';

export class SubscriptionModel {
	constructor(private readonly store: IStoreAdapter) {}

	get(subscriberType: SubscriberType, subscriberId: string): Promise<ISubscription | null> {
		return getSubscription(subscriberType, subscriberId, this.store);
	}

	upsert(data: Parameters<typeof upsertSubscription>[0]): Promise<void> {
		return upsertSubscription(data, this.store);
	}
}
