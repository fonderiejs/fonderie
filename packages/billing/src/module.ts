import type { IFonderieModule, IFonderieApp, IReadinessProblem } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import type { EventBus } from '@fonderie/events';

import type { IBillingConfig } from './config';
import { buildBillingRoutes } from './routes';
import { syncPlansToDB } from './services/plans';
import { syncCreditPacksToDB } from './services/credit-packs';
import { collectBillingReadinessProblems } from './services/notify';
import { withBilling } from './middlewares/billing';
import { createBackend } from './backends';

export class BillingModule implements IFonderieModule {
	readonly name = '@fonderie/billing';
	readonly deps = ['@fonderie/auth'];

	constructor(
		private store: IStoreAdapter,
		private config: IBillingConfig,
		// Optional — when provided, billing publishes fonderie.billing.* domain
		// events (subscription lifecycle, wallet credits, pack purchases,
		// grants) that in-process subscribers and @fonderie/webhooks consume.
		private bus?: EventBus,
	) {}

	async install(app: IFonderieApp): Promise<void> {
		if (!this.config.wallet && this.config.plans.some((p) => p.wallet)) {
			// eslint-disable-next-line no-console
			console.warn(
				'[billing] plans define wallet economics but config.wallet is not set — wallet features are disabled',
			);
		}

		await syncPlansToDB(this.config, this.store);
		if (this.config.wallet) await syncCreditPacksToDB(this.config, this.store);

		const backend = createBackend(this.config.rateLimit?.backend, this.store);

		// Global middleware — resolves subscriber + plan, enforces rate limits,
		// caches IBillingContext on ctx.meta['billing'] for every request.
		// Runs after auth (ctx.user available), before route handlers.
		app.use(withBilling(this.store, this.config, backend, this.bus));

		const routes = buildBillingRoutes(this.store, this.config, this.bus);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}

	// Fail-closed at boot in production: taking money without a path to inform
	// the customer (an EventBus + config.resolveRecipient reaching courier) is a
	// Processing-Integrity failure, not an integrator's later choice. Warns —
	// rather than errors — outside production so dev/test needn't wire courier.
	checkReadiness(): IReadinessProblem[] {
		return collectBillingReadinessProblems(this.config, this.bus !== undefined);
	}
}
