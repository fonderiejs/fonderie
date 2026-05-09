import type { IStoreAdapter } from '@fonderie-js/store';

import { recordUsage, getUsage } from '../services/usage';

export class UsageModel {
	constructor(private readonly store: IStoreAdapter) {}

	record(opts: Parameters<typeof recordUsage>[0]): Promise<void> {
		return recordUsage(opts, this.store)
	}

	get(workspaceId: string, metric: string, since: Date): Promise<number> {
		return getUsage(workspaceId, metric, since, this.store)
	}
}
