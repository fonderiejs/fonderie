import type { IFonderieApp, IFonderieModule } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import type { ICustomersConfig } from './config';
import { buildCustomerRoutes } from './routes';

export class CustomersModule implements IFonderieModule {
	readonly name = '@fonderie/customers';
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
