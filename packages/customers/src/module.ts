import type { IFonderieApp, IFonderieModule } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import type { ICustomersConfig } from './config';
import { buildCustomerRoutes } from './routes';

export class CustomersModule implements IFonderieModule {
	readonly name = '@fonderie/customers';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
	readonly deps = ['@fonderie/workspaces'];

	constructor(
		private store: IStoreAdapter,
		private config: ICustomersConfig = {},
		private bus?: EventBus,
	) {}

	install(app: IFonderieApp): void {
		const routes = buildCustomerRoutes(this.store, this.config, this.bus);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
