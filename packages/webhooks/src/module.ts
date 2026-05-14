import type { IFonderieModule, IFonderieApp } from '@fonderie-js/core';
import type { IStoreAdapter } from '@fonderie-js/store';
import type { EventBus } from '@fonderie-js/events';

import type { IWebhooksConfig } from './config';
import { WebhookDispatcher } from './dispatcher';
import { buildWebhookRoutes } from './routes';

export class WebhooksModule implements IFonderieModule {
	readonly name = '@fonderie-js/webhooks';
	readonly deps = ['@fonderie-js/auth', '@fonderie-js/workspaces'];

	private retryTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly store: IStoreAdapter,
		private readonly config: IWebhooksConfig = {},
		private readonly bus?: EventBus,
	) {}

	install(app: IFonderieApp): void {
		const dispatcher = new WebhookDispatcher(this.store, this.config);

		this.bus?.on<Record<string, unknown>>(
			'*',
			async (payload, meta) => {
				await dispatcher.dispatch(payload, meta);
			},
			'webhooks',
		);

		const interval = this.config.retryInterval ?? 60_000;
		this.retryTimer = setInterval(() => {
			dispatcher.retry().catch((err) => console.error('[webhooks] retry error:', err));
		}, interval);

		const routes = buildWebhookRoutes(this.store, this.config);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
