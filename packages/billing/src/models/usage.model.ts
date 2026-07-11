import type { IStoreAdapter } from '@fonderie/store';
import type { SubscriberType } from '../types';

import { recordUsage, getUsage } from '../services/usage';

export class UsageModel {
	constructor(private readonly store: IStoreAdapter) {}

	record(opts: Parameters<typeof recordUsage>[0]): Promise<void> {
		return recordUsage(opts, this.store);
	}

	get(
		subscriberType: SubscriberType,
		subscriberId: string,
		metric: string,
		since: Date,
	): Promise<number> {
		return getUsage(subscriberType, subscriberId, metric, since, this.store);
	}
}
