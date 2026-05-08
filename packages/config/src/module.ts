import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter }                  from '@fonderie-js/store';

import type { IRemoteConfigOptions }           from './config';

import { RemoteConfigManager, CONFIG_MANAGER_KEY } from './manager';
import { configContextMiddleware }             from './middlewares/config-context';

export class RemoteConfigModule implements IFonderieModule {
	readonly name    = '@fonderie-js/config';
	readonly manager: RemoteConfigManager

	constructor(
		store:   IStoreAdapter,
		options: IRemoteConfigOptions = {},
	) {
		this.manager = new RemoteConfigManager(store, options);
	}

	async install(app: IFonderieApp): Promise<void> {
		await this.manager.boot();
		app.use(configContextMiddleware(this.manager));
	}
}
