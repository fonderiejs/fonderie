import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';

import type { IRemoteConfigOptions } from './config';

import { RemoteConfigManager, CONFIG_MANAGER_KEY } from './manager';
import { configContextMiddleware } from './middlewares/config-context';

export class RemoteConfigModule implements IFonderieModule {
	readonly name = '@fonderie/config';
	readonly manager: RemoteConfigManager;

	constructor(store: IStoreAdapter, options: IRemoteConfigOptions = {}) {
		this.manager = new RemoteConfigManager(store, options);
	}

	async install(app: IFonderieApp): Promise<void> {
		await this.manager.boot();
		app.use(configContextMiddleware(this.manager));
	}
}
