import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter }                 from '@fonderie-js/store';

import type { IPermissionsConfig }            from './config';
import { PermissionsEngine }                  from './engine';

export const PERMISSIONS_ENGINE_KEY = 'fonderie.permissions.engine';

export class PermissionsModule implements IFonderieModule {
	readonly engine: PermissionsEngine;
	readonly name = '@fonderie-js/permissions';

	constructor(
		store:  IStoreAdapter,
		config: IPermissionsConfig = {},
	) {
		this.engine = new PermissionsEngine(store, config);
	}

	install(app: IFonderieApp): void {
		const engine = this.engine;

		// Inject engine into every request context
		// requirePermission() reads it from here — no manual passing needed
		app.use(async (ctx, next) => {
			ctx.meta[PERMISSIONS_ENGINE_KEY] = engine;
			return next();
		})
	}
}
