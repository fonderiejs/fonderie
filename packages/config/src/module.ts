import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigOptions } from './config';

import { RemoteConfigManager } from './manager';
import { configContextMiddleware } from './middlewares/config-context';
import { buildAdminRoutes } from './admin';
import { noopEncryptor } from './crypto';

export class ConfigModule implements IFonderieModule {
	readonly name = '@fonderie/config';
	readonly manager: RemoteConfigManager;

	constructor(
		private store: IStoreAdapter,
		private options: IConfigOptions = {},
	) {
		this.manager = new RemoteConfigManager(store, options);
	}

	async install(app: IFonderieApp): Promise<void> {
		await this.manager.boot();
		app.use(configContextMiddleware(this.manager));

		// Admin HTTP surface — only when a bootstrap token is configured
		// (no token, no exposed admin routes: fail-closed).
		if (this.options.adminToken) {
			const routes = buildAdminRoutes(
				this.store,
				this.options.adminToken,
				this.options.secretEncryptor ?? noopEncryptor,
			);
			for (const [method, path, handler] of routes) {
				app.addRoute(method, path, handler);
			}
		}
	}
}
