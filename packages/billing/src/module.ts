import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';

import type { IBillingConfig } from './config';
import { buildBillingRoutes } from './routes';
import { syncPlansToDB } from './services/plans';
import { withBilling } from './middlewares/billing';
import { createBackend } from './backends';

export class BillingModule implements IFonderieModule {
	readonly name = '@fonderie-js/billing';
	readonly deps = ['@fonderie-js/auth'];

	constructor(
		private store: IStoreAdapter,
		private config: IBillingConfig,
	) {}

	async install(app: IFonderieApp): Promise<void> {
		await syncPlansToDB(this.config, this.store);

		const backend = createBackend(this.config.rateLimit?.backend, this.store);

		// Global middleware — resolves subscriber + plan, enforces rate limits,
		// caches IBillingContext on ctx.meta['billing'] for every request.
		// Runs after auth (ctx.user available), before route handlers.
		app.use(withBilling(this.store, this.config, backend));

		const routes = buildBillingRoutes(this.store, this.config);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
