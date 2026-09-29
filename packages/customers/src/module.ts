import type { IEventCatalogEntry, IFonderieApp, IFonderieModule } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import type { IStoreAdapter } from '@fonderie/store';

import type { ICustomersConfig } from './config';
import { EVENT_KEYS } from './config';
import { buildCustomerRoutes } from './routes';

export class CustomersModule implements IFonderieModule {
	readonly name = '@fonderie/customers';
	// Baked in at build time by tsup.base, so the operator's Modules page can
	// say what is actually deployed rather than 'not reported'.
	readonly version = process.env['FONDERIE_PKG_VERSION'] ?? '0.0.0-dev';
	readonly deps = ['@fonderie/workspaces'];

	constructor(
		private store: IStoreAdapter,
		private config: ICustomersConfig = {},
		private bus?: EventBus,
	) {}

	// Clients may learn that a customer of THEIR workspace changed (realtime
	// delivery): members of that workspace only, and the event carries ids —
	// the client re-reads the customer through the API, which applies access.
	describeEvents(): IEventCatalogEntry[] {
		const entry = (type: string, what: string): IEventCatalogEntry<{ customerId: string; workspaceId: string }> => ({
			type,
			description: `A customer was ${what}`,
			audience: 'workspace',
			scope: (p) => ({ workspaceId: p.workspaceId }),
			project: (p) => ({ customerId: p.customerId, workspaceId: p.workspaceId }),
		});
		return [
			entry(EVENT_KEYS.customerCreated, 'added to the workspace'),
			entry(EVENT_KEYS.customerUpdated, 'updated'),
			entry(EVENT_KEYS.customerDeleted, 'deleted'),
			entry(EVENT_KEYS.customerBlacklisted, 'blacklisted'),
			entry(EVENT_KEYS.customerUnblacklisted, 'removed from the blacklist'),
		] as IEventCatalogEntry[];
	}

	install(app: IFonderieApp): void {
		const routes = buildCustomerRoutes(this.store, this.config, this.bus);
		for (const [method, path, ...handlers] of routes) {
			app.addRoute(method, path, ...handlers);
		}
	}
}
