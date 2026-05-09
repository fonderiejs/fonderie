import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';

import type { IBillingConfig }  from './config';
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
	const plan         = planController(store, config)
	const subscription = subscriptionController(store)
	const checkout     = checkoutController(store, config)
	const usage        = usageController(store)
	const webhook      = webhookController(store, config)

	return [
		// Plans — public list
		['GET',    '/billing/plans',              plan.list],

		// Plans — admin CRUD
		['POST',   '/billing/plans',              plan.create],
		['GET',    '/billing/plans/:planId',      plan.get],
		['PUT',    '/billing/plans/:planId',      plan.update],
		['DELETE', '/billing/plans/:planId',      plan.remove],

		// Subscription — read
		['GET',    '/workspaces/:workspaceId/billing/subscription', subscription.get],

		// Checkout — creates Stripe session
		['POST',   '/workspaces/:workspaceId/billing/checkout',     checkout.createSession],

		// Portal — manage existing subscription
		['POST',   '/workspaces/:workspaceId/billing/portal',       checkout.createPortal],

		// Webhook — no auth, signature verified internally
		['POST',   '/billing/webhook',            webhook.handle],

		// Usage metering
		['POST',   '/workspaces/:workspaceId/billing/usage',        usage.record],
		['GET',    '/workspaces/:workspaceId/billing/usage/:metric', usage.get],
	]
}
