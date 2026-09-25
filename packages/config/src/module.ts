import type { IAdminDescription, IFonderieModule, IFonderieApp, IReadinessProblem } from '@fonderie/core';
import { validateAdminToken } from '@fonderie/core/middlewares';
import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigOptions } from './config';

import { RemoteConfigManager } from './manager';
import { configContextMiddleware } from './middlewares/config-context';
import { buildAdminRoutes, describeAdminRoutes } from './admin';

export class ConfigModule implements IFonderieModule {
	readonly name = '@fonderie/config';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
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
				this.options.secretEncryptor,
			);
			for (const [method, path, handler] of routes) {
				app.addRoute(method, path, handler);
			}
		}
	}

	describeAdmin(): IAdminDescription {
		return { routes: describeAdminRoutes(this.store, this.options.secretEncryptor) };
	}

	// Reported by FonderieApp.checkProductionReadiness.
	checkReadiness(): IReadinessProblem[] {
		const problems: IReadinessProblem[] = [];
		// This used to escalate to an ERROR in production only when THIS module
		// had its own adminToken, on the reasoning that otherwise "the surface
		// isn't registered at all". That reasoning was wrong: describeAdmin() is
		// unconditional, so @fonderie/admin mounts the secrets routes under
		// /_admin and reveals them regardless of this module's token — the
		// normal deployment shape, and precisely the one the check waved through
		// as a warning.
		//
		// It is a warning again now, but for a sound reason rather than a
		// mistaken one: without an encryptor the secrets routes REFUSE (503
		// SECRETS_DISABLED), so there is nothing to store in clear and nothing
		// to reveal. The exposure is gone, so the flag is advice, not an alarm.
		// checkReadiness cannot see whether an admin host is present — it runs
		// before any install() — so removing the exposure is the only fix that
		// does not rely on a guess.
		if (!this.options.secretEncryptor) {
			problems.push({
				module: this.name,
				severity: 'warning',
				message:
					'no secretEncryptor configured — the secrets admin surface refuses every ' +
					'request (503 SECRETS_DISABLED) rather than handling plaintext. Pass ' +
					'secretEncryptor: createAesGcmEncryptor(key) to enable it; config entries ' +
					'are unaffected.',
			});
		}

		// Shared admin-token strength rule (@fonderie/core/middlewares) — one
		// definition across billing/config/courier.
		problems.push(...validateAdminToken(this.options.adminToken, { module: this.name }));
		return problems;
	}
}
