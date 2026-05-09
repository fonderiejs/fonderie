import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter }                 from '@fonderie-js/store';

import { buildAuthRoutes }                    from './routes';
import type { IAuthConfig }                    from './config';
import { withSession }                        from './middlewares/session';

export class AuthModule implements IFonderieModule {
	readonly name = '@fonderie-js/auth'

	constructor(
		private store:  IStoreAdapter,
		private config: IAuthConfig,
	) {}

	install(app: IFonderieApp): void {
		// 1. Session middleware runs on every request — populates ctx.user
		app.use(withSession(this.store, this.config));

		// 2. Register auth routes
		const routes = buildAuthRoutes(this.store, this.config);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
