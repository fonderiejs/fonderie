import type { IAdminDescription, IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IReadinessProblem } from '@fonderie/core';
import { buildAuthRoutes } from './routes';
import type { IAuthConfig } from './config';
import { validateAuthConfig, collectAuthConfigProblems } from './services/config-guard';
import { withSession } from './middlewares/session';
import { describeAuthAdminRoutes } from './admin';

export class AuthModule implements IFonderieModule {
	readonly name = '@fonderie/auth';

	constructor(
		private store: IStoreAdapter,
		private config: IAuthConfig,
		private bus?: EventBus,
	) {
		// Fail fast on an insecure jwtSecret (fatal in production) before boot.
		validateAuthConfig(config);
	}

	// Users, sessions, login history, suspend — only through @fonderie/admin.
	describeAdmin(): IAdminDescription {
		return { routes: describeAuthAdminRoutes(this.store) };
	}

	// Report config problems for app.checkProductionReadiness() (data, not throw).
	checkReadiness(): IReadinessProblem[] {
		return collectAuthConfigProblems(this.config);
	}

	install(app: IFonderieApp): void {
		app.use(withSession(this.store, this.config));

		const routes = buildAuthRoutes(this.store, this.config, this.bus);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
