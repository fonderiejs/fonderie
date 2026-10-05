import type { IAdminDescription, IEventCatalogEntry, IFonderieContext, IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IReadinessProblem } from '@fonderie/core';
import { buildAuthRoutes } from './routes';
import { EVENT_KEYS, type IAuthConfig, type ISessionRevokedEvent } from './config';
import { validateAuthConfig, collectAuthConfigProblems } from './services/config-guard';
import { withSession } from './middlewares/session';
import { describeAuthAdminRoutes } from './admin';
import { STEP_UP_VERIFIER, hasStepUp } from './services/step-up';

export class AuthModule implements IFonderieModule {
	readonly name = '@fonderie/auth';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';

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
		return { routes: describeAuthAdminRoutes(this.store, this.bus, this.config) };
	}

	// Live sign-out (docs/SESSION-DESIGN.md, Phase 5): a revoked device hears it
	// at once over @fonderie/sse — only the user it is about, ids only.
	describeEvents(): IEventCatalogEntry[] {
		const revoked: IEventCatalogEntry<ISessionRevokedEvent> = {
			type: EVENT_KEYS.sessionRevoked,
			description: 'Some of your sessions were signed out — sign out if this device is one of them',
			audience: 'user',
			scope: (p) => ({ userId: p.userId }),
			project: (p) => ({ sids: p.sids, reason: p.reason }),
		};
		return [revoked as IEventCatalogEntry];
	}

	// Report config problems for app.checkProductionReadiness() (data, not throw).
	checkReadiness(): IReadinessProblem[] {
		return collectAuthConfigProblems(this.config);
	}

	install(app: IFonderieApp): void {
		app.use(withSession(this.store, this.config));
		// Step-up (insider threat, Phase 4): a guarded route in any brick asks
		// ctx.meta[STEP_UP_VERIFIER](ctx) whether this request carries a fresh
		// proof for its user — no brick imports auth to ask.
		const config = this.config;
		app.use(async (ctx, next) => {
			ctx.meta[STEP_UP_VERIFIER] = async (c: IFonderieContext) => hasStepUp(c, config);
			return next();
		});

		// New users start in the app's system locale (core owns it) unless they
		// signed up in another one.
		const routes = buildAuthRoutes(this.store, this.config, this.bus, app.locales);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
