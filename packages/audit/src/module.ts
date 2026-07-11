import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import { buildAuditRoutes } from './routes';

export class AuditModule implements IFonderieModule {
	readonly name = '@fonderie/audit';
	readonly deps = ['@fonderie/auth', '@fonderie/workspaces'];

	constructor(private readonly store: IStoreAdapter) {}

	install(app: IFonderieApp): void {
		for (const [method, path, ...handlers] of buildAuditRoutes(this.store)) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
