import type { IFonderieApp, IFonderieModule } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IMediaConfig } from './config';
import { buildMediaRoutes } from './routes';

/**
 * Provider-abstracted asset storage. Register it like any other brick; it adds
 * `POST /media`, `GET /media/:id` (public), and `DELETE /media/:id`, and stores
 * bytes through the configured `IStorageProvider` (`DbBlobProvider` for zero
 * infra, swappable for object storage). Depends on `@fonderie/auth` for the
 * authenticated caller on upload/delete.
 */
export class MediaModule implements IFonderieModule {
	readonly name = '@fonderie/media';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
	readonly deps = ['@fonderie/auth'];

	constructor(
		private readonly store: IStoreAdapter,
		private readonly config: IMediaConfig,
	) {}

	install(app: IFonderieApp): void {
		for (const [method, path, ...handlers] of buildMediaRoutes(this.store, this.config)) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
