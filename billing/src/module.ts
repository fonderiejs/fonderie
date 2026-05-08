import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter }                 from '@fonderie-js/store';

import type { IBillingConfig }                from './config';

import { buildBillingRoutes }                 from './routes';
import { syncPlansToDB }                      from './services/plans';

export class BillingModule implements IFonderieModule {
	readonly name = '@fonderie-js/billing';

	constructor(
		private store:  IStoreAdapter,
		private config: IBillingConfig,
	) {}

	async install(app: IFonderieApp): Promise<void> {
		// Sync plan definitions from config into DB on boot
		await syncPlansToDB(this.config, this.store);

		const routes = buildBillingRoutes(this.store, this.config);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
