import type { IStoreAdapter } from '@fonderie-js/store';
import type { Middleware }     from '@fonderie-js/core';
import { requireAuth }         from '@fonderie-js/core/middlewares';

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
		['POST',   '/billing/plans',              requireAuth,plan.create],
		['GET',    '/billing/plans/:planId',      requireAuth,plan.get],
		['PUT',    '/billing/plans/:planId',      requireAuth,plan.update],
		['DELETE', '/billing/plans/:planId',      requireAuth,plan.remove],

		// Subscription — read
		['GET',    '/workspaces/:workspaceId/billing/subscription', requireAuth,subscription.get],

		// Checkout — creates Stripe session
		['POST',   '/workspaces/:workspaceId/billing/checkout',     requireAuth,checkout.createSession],

		// Portal — manage existing subscription
		['POST',   '/workspaces/:workspaceId/billing/portal',       requireAuth,checkout.createPortal],

		// Webhook — no requireAuth,signature verified internally
		['POST',   '/billing/webhook',            webhook.handle],

		// Usage metering
		['POST',   '/workspaces/:workspaceId/billing/usage',        requireAuth,usage.record],
		['GET',    '/workspaces/:workspaceId/billing/usage/:metric', requireAuth,usage.get],
	]
}
