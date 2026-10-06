import type { IStoreAdapter } from '@fonderie/store';

import type { ISubscription, SubscriberType } from '../types';
import {
	getSubscription,
	hasConsumedTrial,
	hasOwnerConsumedTrial,
	markTrialConsumed,
	upsertSubscription,
	upsertSubscriptionWithPrior,
} from '../services/subscriptions';

export class SubscriptionModel {
	constructor(private readonly store: IStoreAdapter) {}

	get(subscriberType: SubscriberType, subscriberId: string): Promise<ISubscription | null> {
		return getSubscription(subscriberType, subscriberId, this.store);
	}

	upsert(data: Parameters<typeof upsertSubscription>[0]): Promise<boolean> {
		return upsertSubscription(data, this.store);
	}

	upsertWithPrior(
		data: Parameters<typeof upsertSubscription>[0],
		options: { markTrialConsumed?: boolean } = {},
	): Promise<{ applied: boolean; priorStatus: string | null }> {
		return upsertSubscriptionWithPrior(data, this.store, options);
	}

	hasConsumedTrial(subscriberType: SubscriberType, subscriberId: string): Promise<boolean> {
		return hasConsumedTrial(subscriberType, subscriberId, this.store);
	}

	hasOwnerConsumedTrial(workspaceId: string): Promise<boolean> {
		return hasOwnerConsumedTrial(workspaceId, this.store);
	}

	markTrialConsumed(subscriberType: SubscriberType, subscriberId: string): Promise<void> {
		return markTrialConsumed(subscriberType, subscriberId, this.store);
	}
}
