import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter }                 from '@fonderie-js/store';

import { buildAuditRoutes } from './routes';

export class AuditModule implements IFonderieModule {
	readonly name = '@fonderie-js/audit';
	readonly deps = ['@fonderie-js/auth', '@fonderie-js/workspaces'];

	constructor(private readonly store: IStoreAdapter) {}

	install(app: IFonderieApp): void {
		for (const [method, path, ...handlers] of buildAuditRoutes(this.store)) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
