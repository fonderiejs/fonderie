import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import { buildAuthRoutes } from './routes';
import type { IAuthConfig } from './config';
import { withSession } from './middlewares/session';

export class AuthModule implements IFonderieModule {
	readonly name = '@fonderie/auth';

	constructor(
		private store: IStoreAdapter,
		private config: IAuthConfig,
		private bus?: EventBus,
	) {}

	install(app: IFonderieApp): void {
		app.use(withSession(this.store, this.config));

		const routes = buildAuthRoutes(this.store, this.config, this.bus);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
