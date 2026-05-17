import type { IFonderieApp, IFonderieModule } from '@fonderie-js/core';
import type { EventBus } from '@fonderie-js/events';
import type { IStoreAdapter } from '@fonderie-js/store';

import type { ICustomersConfig } from './config';
import { buildCustomerRoutes } from './routes';

export class CustomersModule implements IFonderieModule {
	readonly name = '@fonderie-js/customers';
	readonly deps = ['@fonderie-js/workspaces'];

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
