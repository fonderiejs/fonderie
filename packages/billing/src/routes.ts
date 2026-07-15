import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import { requireAuth, validate } from '@fonderie/core/middlewares';

import { checkoutSchema, createPlanSchema, recordUsageSchema, updatePlanSchema } from './schemas';

import type { IBillingConfig } from './config';
import { planController } from './controllers/plan.controller';
import { subscriptionController } from './controllers/subscription.controller';
import { checkoutController } from './controllers/checkout.controller';
import { usageController } from './controllers/usage.controller';
import { webhookController } from './controllers/webhook.controller';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildBillingRoutes(
	store: IStoreAdapter,
	config: IBillingConfig,
): RouteDefinition[] {
	const plan = planController(store);
	const subscription = subscriptionController(store);
	const checkout = checkoutController(store, config);
	const usage = usageController(store);
	const webhook = webhookController(store, config);

	return [
		// Plans — public read-only
		['GET', '/plans', plan.list],
		['GET', '/plans/:planId', plan.get],

		// Plans — admin write (caller is responsible for authorization)
		['POST', '/plans', validate(createPlanSchema), plan.create],
		['PUT', '/plans/:planId', validate(updatePlanSchema), plan.update],
		['DELETE', '/plans/:planId', plan.delete],

		// Billing — subscriber resolved from X-Workspace-ID header (workspace) or session (user)
		// Workspace membership is verified automatically by the withBilling global middleware
		['GET', '/billing/subscription', requireAuth, subscription.get],
		['POST', '/billing/checkout', requireAuth, validate(checkoutSchema), checkout.createSession],
		['POST', '/billing/portal', requireAuth, checkout.createPortal],
		['POST', '/billing/usage', requireAuth, validate(recordUsageSchema), usage.record],
		['GET', '/billing/usage/:metric', requireAuth, usage.get],

		// Webhook — signature verified inside the handler
		['POST', '/billing/webhook', webhook.handle],
	];
}
