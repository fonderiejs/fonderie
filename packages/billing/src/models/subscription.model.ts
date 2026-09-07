import type { IStoreAdapter } from '@fonderie/store';

import type { ISubscription, SubscriberType } from '../types';
import {
	getSubscription,
	hasConsumedTrial,
	markTrialConsumed,
	upsertSubscription,
} from '../services/subscriptions';

export class SubscriptionModel {
	constructor(private readonly store: IStoreAdapter) {}

	get(subscriberType: SubscriberType, subscriberId: string): Promise<ISubscription | null> {
		return getSubscription(subscriberType, subscriberId, this.store);
	}

	upsert(data: Parameters<typeof upsertSubscription>[0]): Promise<boolean> {
		return upsertSubscription(data, this.store);
	}

	hasConsumedTrial(subscriberType: SubscriberType, subscriberId: string): Promise<boolean> {
		return hasConsumedTrial(subscriberType, subscriberId, this.store);
	}

	markTrialConsumed(subscriberType: SubscriberType, subscriberId: string): Promise<void> {
		return markTrialConsumed(subscriberType, subscriberId, this.store);
	}
}
