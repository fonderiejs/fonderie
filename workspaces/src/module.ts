import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter }                 from '@fonderie-js/store';

import type { IWorkspacesConfig }              from './config';
import { buildWorkspaceRoutes }               from './routes';

export class WorkspacesModule implements IFonderieModule {
	readonly name = '@fonderie-js/workspaces';

	constructor(
		private store:  IStoreAdapter,
		private config: IWorkspacesConfig = {},
	) {}

	install(app: IFonderieApp): void {
		const routes = buildWorkspaceRoutes(this.store, this.config);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
