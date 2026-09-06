import type { IFonderieModule, IFonderieApp, IReadinessProblem } from '@fonderie/core';
import { validateAdminToken } from '@fonderie/core/middlewares';
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

	// Reported by FonderieApp.checkProductionReadiness. Only the admin surface
	// carries a secret worth guarding; when no adminToken is set the surface
	// isn't registered at all (fail-closed), so there's nothing to flag.
	checkReadiness(): IReadinessProblem[] {
		const problems: IReadinessProblem[] = [];
		// Secrets are stored plaintext at rest unless an encryptor is configured.
		// It's a hard error in production when the admin secrets surface is enabled
		// (a plaintext secret is revealable over the API) — this fails the boot gate.
		// Otherwise (dev, or no admin surface) it's a warning so back-compatible
		// deployments that never expose secrets aren't broken.
		if (!this.options.secretEncryptor) {
			const inProd = process.env['NODE_ENV'] === 'production';
			const secretsExposed = Boolean(this.options.adminToken);
			problems.push({
				module: this.name,
				severity: inProd && secretsExposed ? 'error' : 'warning',
				message:
					'no secretEncryptor configured — secrets are stored plaintext at rest; ' +
					'use createAesGcmEncryptor' +
					(inProd && secretsExposed
						? ' (required in production when the secrets admin surface is enabled)'
						: ' for production'),
			});
		}

		// Shared admin-token strength rule (@fonderie/core/middlewares) — one
		// definition across billing/config/courier.
		problems.push(...validateAdminToken(this.options.adminToken, { module: this.name }));
		return problems;
	}
}
