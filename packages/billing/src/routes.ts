import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import { requireAuth, validate } from '@fonderie/core/middlewares';

import {
	cancelSubscriptionSchema,
	checkoutSchema,
	createPlanSchema,
	grantWalletSchema,
	recordUsageSchema,
	updatePlanSchema,
	walletCheckoutSchema,
} from './schemas';

import type { IBillingConfig } from './config';
import { PriceCache } from './services/price-cache';
import { planController } from './controllers/plan.controller';
import { subscriptionController } from './controllers/subscription.controller';
import { checkoutController } from './controllers/checkout.controller';
import { usageController } from './controllers/usage.controller';
import { walletController } from './controllers/wallet.controller';
import { webhookController } from './controllers/webhook.controller';
import { paymentWebhookController } from './controllers/payment-webhook.controller';
import { requireAdminToken } from './middlewares/admin-token';

type RouteDefinition = [string, string, ...Middleware[]];

export function buildBillingRoutes(
	store: IStoreAdapter,
	config: IBillingConfig,
	bus?: EventBus,
): RouteDefinition[] {
	const priceCache = new PriceCache({
		ttlMs: config.pricing?.cacheTtlMs,
		graceMs: config.pricing?.transferGraceMs,
		maxStaleMs: config.pricing?.maxStaleMs,
	});
	const plan = planController(store, config, priceCache);
	const subscription = subscriptionController(store, config);
	const checkout = checkoutController(store, config);
	const usage = usageController(store);
	const webhook = webhookController(store, config, priceCache, bus);

	const routes: RouteDefinition[] = [
		// Plans — public read-only
		['GET', '/plans', plan.list],
		['GET', '/plans/:planId', plan.get],

		// Plans — admin write (caller is responsible for authorization)
		['POST', '/plans', validate(createPlanSchema), plan.create],
		['PUT', '/plans/:planId', validate(updatePlanSchema), plan.update],
		['DELETE', '/plans/:planId', plan.delete],

		// Billing — subscriber resolved from X-Workspace-ID header (workspace) or session (user).
		// The withBilling global middleware verifies workspace membership against
		// fonderie_role_user_workspaces (403 for non-members, fail-closed) before
		// any billing surface acts on a header-derived workspace id.
		['GET', '/billing/subscription', requireAuth, subscription.get],
		['POST', '/billing/checkout', requireAuth, validate(checkoutSchema), checkout.createSession],
		['POST', '/billing/portal', requireAuth, checkout.createPortal],
		// First-party lifecycle controls (cancel at period end / immediately;
		// un-cancel). 501 when the provider doesn't implement them; the portal
		// remains a self-serve fallback.
		[
			'POST',
			'/billing/subscription/cancel',
			requireAuth,
			validate(cancelSubscriptionSchema),
			subscription.cancel,
		],
		['POST', '/billing/subscription/reactivate', requireAuth, subscription.reactivate],
		['POST', '/billing/usage', requireAuth, validate(recordUsageSchema), usage.record],
		['GET', '/billing/usage/:metric', requireAuth, usage.get],

		// Webhook — signature verified inside the handler
		['POST', '/billing/webhook', webhook.handle],
	];

	// Stored-value wallet — opt-in via config.wallet; absent config registers
	// nothing and changes nothing for subscription-only consumers.
	if (config.wallet) {
		const wallet = walletController(store, config, bus);
		const paymentWebhook = paymentWebhookController(store, config, bus);
		routes.push(
			['GET', '/billing/wallet', requireAuth, wallet.get],
			['GET', '/billing/wallet/transactions', requireAuth, wallet.transactions],
			['POST', '/billing/wallet/checkout', requireAuth, validate(walletCheckoutSchema), wallet.checkout],
			// Payment webhook — separate endpoint and secret from the
			// subscription webhook; signature verified inside the handler.
			['POST', '/billing/webhook/payment', paymentWebhook.handle],
		);
		// Manual grants are an ops surface: bootstrap admin token, not sessions.
		if (config.wallet.adminToken) {
			routes.push([
				'POST',
				'/billing/wallet/grant',
				requireAdminToken(config.wallet.adminToken),
				validate(grantWalletSchema),
				wallet.grant,
			]);
		}
	}

	return routes;
}
