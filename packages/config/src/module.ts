import type { IFonderieModule, IFonderieApp, IReadinessProblem } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IConfigOptions } from './config';

import { RemoteConfigManager } from './manager';
import { configContextMiddleware } from './middlewares/config-context';
import { buildAdminRoutes } from './admin';
import { noopEncryptor } from './crypto';

// A weak admin token guards the plaintext-secret reveal surface, so hold it to
// the same bar as an auth signing secret: 32+ chars and not a copy-pasted
// placeholder. Mirrors the jwtSecret checks in @fonderie/auth's config-guard.
const MIN_ADMIN_TOKEN_LENGTH = 32;
const PLACEHOLDER_TOKEN =
	/dev-secret|test-secret|changeme|change-me|your[-_]secret|placeholder|example|insecure|admin-token|min-32-chars/i;

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

		const token = this.options.adminToken;
		if (token) {
			if (token.length < MIN_ADMIN_TOKEN_LENGTH) {
				problems.push({
					module: this.name,
					severity: 'error',
					message: `adminToken must be at least ${MIN_ADMIN_TOKEN_LENGTH} characters (got ${token.length})`,
				});
			} else if (PLACEHOLDER_TOKEN.test(token)) {
				problems.push({
					module: this.name,
					severity: 'error',
					message: 'adminToken looks like a placeholder or dev-default value',
				});
			}
		}
		return problems;
	}
}
