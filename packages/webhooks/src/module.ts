import type { IFonderieModule, IFonderieApp } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IWebhooksConfig } from './config';
import { WebhookDispatcher } from './dispatcher';
import { buildWebhookRoutes } from './routes';

export class WebhooksModule implements IFonderieModule {
	readonly name = '@fonderie/webhooks';
	readonly deps = ['@fonderie/auth', '@fonderie/workspaces'];

	private retryTimer: ReturnType<typeof setInterval> | undefined;
	private dispatcher?: WebhookDispatcher;

	constructor(
		private readonly store: IStoreAdapter,
		private readonly config: IWebhooksConfig = {},
		private readonly bus?: EventBus,
	) {}

	install(app: IFonderieApp): void {
		const dispatcher = new WebhookDispatcher(this.store, this.config);
		this.dispatcher = dispatcher;

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

	/**
	 * Run one retry pass over deliveries that are due, then return.
	 *
	 * The timer above is the right driver on a host that outlives the request.
	 * It is NOT available on serverless — an instance is frozen between
	 * requests, so `setInterval` never reliably fires and a failed delivery is
	 * simply never retried, with nothing to see. Until now there was no way to
	 * drive a retry by hand either, so serverless deployments had no recourse
	 * at all; a scheduled ping can now call this.
	 *
	 * Safe to call concurrently with the timer or another instance: claiming is
	 * exclusive, so callers get disjoint sets rather than delivering the same
	 * webhook twice.
	 */
	async retry(): Promise<void> {
		await this.dispatcher?.retry();
	}

	/**
	 * Stop the retry timer. Without this the interval keeps the process alive
	 * after shutdown — it was created and never cleared.
	 */
	stop(): void {
		if (this.retryTimer) {
			clearInterval(this.retryTimer);
			this.retryTimer = undefined;
		}
	}
}
