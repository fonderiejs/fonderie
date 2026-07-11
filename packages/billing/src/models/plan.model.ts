import type { IStoreAdapter } from '@fonderie/store';

import type { IPlan } from '../types';
import type { IBillingConfig } from '../config';
import {
	getDBPlans,
	getPlanById,
	createPlan,
	updatePlan,
	deletePlan,
	getPlans,
	getPlanByName,
} from '../services/plans';

export class PlanModel {
	constructor(private readonly store: IStoreAdapter) {}

	listFromConfig(config: IBillingConfig) {
		return getPlans(config);
	}

	findByNameInConfig(name: string, config: IBillingConfig) {
		return getPlanByName(name, config);
	}

	list(): Promise<IPlan[]> {
		return getDBPlans(this.store);
	}

	findById(id: string): Promise<IPlan | null> {
		return getPlanById(id, this.store);
	}

	create(data: Parameters<typeof createPlan>[0]): Promise<IPlan> {
		return createPlan(data, this.store);
	}

	update(id: string, data: Parameters<typeof updatePlan>[1]): Promise<IPlan | null> {
		return updatePlan(id, data, this.store);
	}

	delete(id: string): Promise<boolean> {
		return deletePlan(id, this.store);
	}
}
