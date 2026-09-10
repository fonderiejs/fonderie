import type { IStoreAdapter } from '@fonderie/store';
import type { Middleware } from '@fonderie/core';
import type { EventBus } from '@fonderie/events';
import { requireAdminToken, requireAuth, validate } from '@fonderie/core/middlewares';

import { requireBillingManager } from './middlewares/require-manager';

import {
	cancelSubscriptionSchema,
	checkoutSchema,
	createPlanSchema,
	grantWalletSchema,
	recordUsageSchema,
	savePaymentMethodSchema,
	updatePlanSchema,
	walletCheckoutSchema,
	walletPreferencesSchema,
	walletPurchaseSchema,
} from './schemas';

import type { IBillingConfig } from './config';
import { PriceCache } from './services/price-cache';
import { planController } from './controllers/plan.controller';
import { subscriptionController } from './controllers/subscription.controller';
import { checkoutController } from './controllers/checkout.controller';
import { accountController } from './controllers/account.controller';
import { usageController } from './controllers/usage.controller';
import { walletController } from './controllers/wallet.controller';
import { webhookController } from './controllers/webhook.controller';
import { paymentWebhookController } from './controllers/payment-webhook.controller';

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
	const account = accountController(store, config);
	const usage = usageController(store);
	const webhook = webhookController(store, config, priceCache, bus);

	// RBAC (M1): money-mutating routes are MANAGER actions for workspace
	// subscribers — withBilling only verifies membership, and a plain member
	// must not spend the workspace's card or cancel its subscription. Reads,
	// usage metering, and user-scoped billing are unaffected.
	const manager = requireBillingManager(store, config);

	const routes: RouteDefinition[] = [
		// Plans — public read-only
		['GET', '/plans', plan.list],
		['GET', '/plans/:planId', plan.get],

		// Billing — subscriber resolved from X-Workspace-ID header (workspace) or session (user).
		// The withBilling global middleware verifies workspace membership against
		// fonderie_role_user_workspaces (403 for non-members, fail-closed) before
		// any billing surface acts on a header-derived workspace id.
		['GET', '/billing/subscription', requireAuth, subscription.get],
		['POST', '/billing/checkout', requireAuth, manager, validate(checkoutSchema), checkout.createSession],
		['POST', '/billing/portal', requireAuth, manager, checkout.createPortal],
		// First-party lifecycle controls (cancel at period end / immediately;
		// un-cancel). 501 when the provider doesn't implement them; the portal
		// remains a self-serve fallback.
		[
			'POST',
			'/billing/subscription/cancel',
			requireAuth,
			manager,
			validate(cancelSubscriptionSchema),
			subscription.cancel,
		],
		['POST', '/billing/subscription/reactivate', requireAuth, manager, subscription.reactivate],
		// Read-only billing-account surface for an in-app billing page: card on
		// file + invoice history. 501 when the provider implements neither.
		['GET', '/billing/payment-method', requireAuth, account.getPaymentMethod],
		['POST', '/billing/payment-method/setup', requireAuth, manager, account.setupPaymentMethod],
		['PUT', '/billing/payment-method', requireAuth, manager, validate(savePaymentMethodSchema), account.savePaymentMethod],
		['DELETE', '/billing/payment-method', requireAuth, manager, account.removePaymentMethod],
		['GET', '/billing/invoices', requireAuth, account.listInvoices],
		['POST', '/billing/usage', requireAuth, validate(recordUsageSchema), usage.record],
		['GET', '/billing/usage/:metric', requireAuth, usage.get],

		// Webhook — signature verified inside the handler
		['POST', '/billing/webhook', webhook.handle],
	];

	// DB-plan write API — an ops surface, guarded by the unified admin token
	// (config.adminToken, with the deprecated config.planAdminToken as fallback),
	// and only registered when a token is available. Unset ⇒ the write routes
	// don't exist (404); GET /plans stays public. Runtime billing reads
	// config.plans in memory, so this never affects charges or access.
	const planAdminToken = config.adminToken ?? config.planAdminToken;
	if (planAdminToken) {
		routes.push(
			['POST', '/plans', requireAdminToken(planAdminToken), validate(createPlanSchema), plan.create],
			['PUT', '/plans/:planId', requireAdminToken(planAdminToken), validate(updatePlanSchema), plan.update],
			['DELETE', '/plans/:planId', requireAdminToken(planAdminToken), plan.delete],
		);
	}

	// Stored-value wallet — opt-in via config.wallet; absent config registers
	// nothing and changes nothing for subscription-only consumers.
	if (config.wallet) {
		const wallet = walletController(store, config, bus);
		const paymentWebhook = paymentWebhookController(store, config, bus);
		routes.push(
			['GET', '/billing/wallet', requireAuth, wallet.get],
			['GET', '/billing/wallet/transactions', requireAuth, wallet.transactions],
			['POST', '/billing/wallet/checkout', requireAuth, manager, validate(walletCheckoutSchema), wallet.checkout],
			['POST', '/billing/wallet/purchase', requireAuth, manager, validate(walletPurchaseSchema), wallet.purchase],
			['POST', '/billing/wallet/preferences', requireAuth, manager, validate(walletPreferencesSchema), wallet.setPreferences],
			// Payment webhook — separate endpoint and secret from the
			// subscription webhook; signature verified inside the handler.
			['POST', '/billing/webhook/payment', paymentWebhook.handle],
		);
		// Manual grants are an ops surface: bootstrap admin token, not sessions.
		// Unified config.adminToken, with the deprecated config.wallet.adminToken
		// as fallback.
		const walletAdminToken = config.adminToken ?? config.wallet.adminToken;
		if (walletAdminToken) {
			routes.push([
				'POST',
				'/billing/wallet/grant',
				requireAdminToken(walletAdminToken),
				validate(grantWalletSchema),
				wallet.grant,
			]);
		}
	}

	return routes;
}
