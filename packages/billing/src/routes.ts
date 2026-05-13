import type { IStoreAdapter }   from '@fonderie-js/store'
import type { Middleware }       from '@fonderie-js/core'
import { requireAuth }           from '@fonderie-js/core/middlewares'

import type { IBillingConfig }    from './config'
import { planController }         from './controllers/plan.controller'
import { subscriptionController } from './controllers/subscription.controller'
import { checkoutController }     from './controllers/checkout.controller'
import { usageController }        from './controllers/usage.controller'
import { webhookController }      from './controllers/webhook.controller'

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
		// Plans — public read-only
		['GET', '/plans',         plan.list],
		['GET', '/plans/:planId', plan.get],

		// Billing — subscriber resolved from X-Workspace-ID header (workspace) or session (user)
		// Workspace membership is verified automatically by the withBilling global middleware
		['GET',  '/billing/subscription',  requireAuth, subscription.get],
		['POST', '/billing/checkout',      requireAuth, checkout.createSession],
		['POST', '/billing/portal',        requireAuth, checkout.createPortal],
		['POST', '/billing/usage',         requireAuth, usage.record],
		['GET',  '/billing/usage/:metric', requireAuth, usage.get],

		// Webhook — signature verified inside the handler
		['POST', '/billing/webhook', webhook.handle],
	]
}
