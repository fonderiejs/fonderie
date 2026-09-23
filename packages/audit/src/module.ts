import type { IAdminDescription, IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { buildAuditRoutes } from './routes';
import { describeAuditAdminRoutes } from './admin';

export class AuditModule implements IFonderieModule {
	readonly name = '@fonderie/audit';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
	readonly deps = ['@fonderie/auth', '@fonderie/workspaces'];

	constructor(private readonly store: IStoreAdapter) {}

	// The cross-workspace read — only through @fonderie/admin.
	describeAdmin(): IAdminDescription {
		return { routes: describeAuditAdminRoutes(this.store) };
	}

	install(app: IFonderieApp): void {
		for (const [method, path, ...handlers] of buildAuditRoutes(this.store)) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
