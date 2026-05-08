import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import {
	webhookHandler,
	getUsageHandler,
	listPlansHandler,
	recordUsageHandler,
	createPortalHandler,
	createCheckoutHandler,
} from './handlers';
import type { IBillingConfig } from './config';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildBillingRoutes(
	store:  IStoreAdapter,
	config: IBillingConfig,
): RouteDefinition[] {
	return [
		// Plans
		['GET', '/billing/plans', listPlansHandler(store, config)],

		// Checkout — creates Stripe session
		['POST', '/workspaces/:workspaceId/billing/checkout', createCheckoutHandler(store, config)],

		// Portal — manage existing subscription
		['POST', '/workspaces/:workspaceId/billing/portal', createPortalHandler(store, config)],

		// Webhook — no auth, signature verified internally
		['POST', '/billing/webhook', webhookHandler(store, config)],

		// Usage metering
		['POST', '/workspaces/:workspaceId/billing/usage',            recordUsageHandler(store)],
		['GET',  '/workspaces/:workspaceId/billing/usage/:metric',    getUsageHandler(store)],
	];
}
