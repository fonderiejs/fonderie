import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';
import { requireAuth }         from '@fonderie-js/core/middlewares';

import type { IBillingConfig }    from './config';
import { planController }         from './controllers/plan.controller';
import { subscriptionController } from './controllers/subscription.controller';
import { checkoutController }     from './controllers/checkout.controller';
import { usageController }        from './controllers/usage.controller';
import { webhookController }      from './controllers/webhook.controller';

type RouteDefinition = [string, string, ...Middleware[]]

export function buildBillingRoutes(
	store:  IStoreAdapter,
	config: IBillingConfig,
): RouteDefinition[] {
	const plan         = planController(store)
	const subscription = subscriptionController(store)
	const checkout     = checkoutController(store, config)
	const usage        = usageController(store)
	const webhook      = webhookController(store, config)

	return [
		// Plans — public read-only (config-driven, synced to DB on boot)
		['GET', '/plans',         plan.list],
		['GET', '/plans/:planId', plan.get],

		// User-level billing (no workspace required)
		['GET',  '/billing/subscription',        requireAuth, subscription.get],
		['POST', '/billing/checkout',            requireAuth, checkout.createSession],
		['POST', '/billing/portal',              requireAuth, checkout.createPortal],
		['POST', '/billing/usage',               requireAuth, usage.record],
		['GET',  '/billing/usage/:metric',       requireAuth, usage.get],

		// Workspace-level billing
		['GET',  '/workspaces/:workspaceId/billing/subscription', requireAuth, subscription.get],
		['POST', '/workspaces/:workspaceId/billing/checkout',     requireAuth, checkout.createSession],
		['POST', '/workspaces/:workspaceId/billing/portal',       requireAuth, checkout.createPortal],
		['POST', '/workspaces/:workspaceId/billing/usage',        requireAuth, usage.record],
		['GET',  '/workspaces/:workspaceId/billing/usage/:metric', requireAuth, usage.get],

		// Webhook — signature verified internally
		['POST', '/billing/webhook', webhook.handle],
	]
}
