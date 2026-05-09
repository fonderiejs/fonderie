import type { IStoreAdapter } from '@fonderie-js/store';

import type { ISubscription } from '../types';
import { getSubscription, upsertSubscription } from '../services/subscriptions';

export class SubscriptionModel {
	constructor(private readonly store: IStoreAdapter) {}

	get(workspaceId: string): Promise<ISubscription | null> {
		return getSubscription(workspaceId, this.store)
	}

	upsert(data: Parameters<typeof upsertSubscription>[0]): Promise<void> {
		return upsertSubscription(data, this.store)
	}
}
