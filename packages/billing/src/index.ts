// ── Public API ───────────────────────────────────────────────────
export { BillingModule } from './module';
export { StripeProvider, SUPPORTED_PAYMENT_OPTIONS } from './providers/stripe';
export type { IStripeProviderOptions, SupportedPaymentOption } from './providers/stripe';

// Middleware
export { requirePlan } from './middlewares/require-plan';
export type { IRequirePlanOptions } from './middlewares/require-plan';
export { withBilling } from './middlewares/billing';
export { requireBillingManager } from './middlewares/require-manager';

// Helpers — sync, read from cached ctx.meta['billing']
export {
	hasFeature,
	getPlanLimit,
	getLimitStatus,
	requireFeature,
	getWalletStatus,
	getWalletRate,
	requireWalletBalance,
	debitWalletForMetric,
	insufficientCreditsResponse,
} from './helpers';

// Config + constants
export { MESSAGE_KEYS, EVENT_KEYS } from './config';
// Built-in default templates for billing's notifications. Pass to courier via
// config.templates.defaults; override any key per-app with a DB row / FS file.
export { DEFAULT_TEMPLATES } from './templates';
export type {
	IBillingConfig,
	IBillingCreditPack,
	IBillingPlan,
	IBillingPlanDefaults,
	IBillingPlanPrice,
	IBillingPlanWallet,
	IBillingPricingConfig,
	IBillingWalletConfig,
	IBillingWalletAutoRecharge,
	IBillingDunningConfig,
	IBillingRecipient,
	ResolveRecipient,
	RateLimitBackendConfig,
	IBillingNotificationsConfig,
	BillingMessageKey,
	BillingEventKey,
} from './config';

// Backends
export { MemoryCounterBackend, DBCounterBackend } from './backends';
export type { ICounterBackend } from './backends';

export { BILLING_INTERVAL, BILLING_INTERVALS, isBillingInterval, WALLET_LEDGER_TYPES } from './types';
export type { BillingInterval, WalletLedgerType } from './types';
// Types
export type {
	IBillingProvider,
	IBillingEvent,
	INormalizedPayment,
	INormalizedReversal,
	INormalizedInvoice,
	INormalizedInvoiceSummary,
	INormalizedCard,
	INormalizedPaymentFailure,
	IResolvedPrice,
	ISubscriptionChange,
} from './providers/types';
export type {
	IPlan,
	ISubscription,
	IWalletBalance,
	IWalletContext,
	IWalletLedgerEntry,
	IWalletRate,
	SubscriptionStatus,
	PolicyEntry,
	LimitStatus,
	IPolicyStatus,
	IBillingContext,
} from './types';
export type {
	IPlanDTO,
	ISubscriptionDTO,
	IWalletDTO,
	IWalletTransactionDTO,
	IPaymentMethodDTO,
	IInvoiceDTO,
} from './dtos/billing';

// DTOs
export {
	toPlanDTO,
	toSubscriptionDTO,
	toWalletDTO,
	toWalletTransactionDTO,
	toPaymentMethodDTO,
	toInvoiceDTO,
} from './dtos/billing';

// Wallet — ledger-backed stored value. Product code debits through
// debitWallet with an idempotency key derived from its own unit of work.
export {
	creditWallet,
	debitWallet,
	reverseWallet,
	findPurchaseByProviderTxId,
	sumReversedCreditsByProviderTxId,
	findLedgerAmountByKey,
	getWalletBalance,
	getWalletLedger,
	ensurePeriodicGrant,
	settleAllowance,
	setSpendPurchased,
	currentGrantPeriod,
	startOfNextPeriod,
	resolvePlanWallet,
	encodeLedgerCursor,
	decodeLedgerCursor,
} from './services/wallet';
export type {
	IWalletSubscriber,
	IWalletMutationResult,
	IWalletReversalResult,
	IWalletPurchaseRow,
	IWalletLedgerPage,
	IGrantResult,
	IResolvedPlanWallet,
} from './services/wallet';
export { InsufficientFundsError, DuplicateTransactionError } from './errors';

// Services (for advanced usage)
export { recordUsage, getUsage } from './services/usage';
export {
	getPlans,
	getPlanByName,
	getDBPlans,
	getPlanById,
	createPlan,
	updatePlan,
	deletePlan,
} from './services/plans';
export {
	getSubscription,
	getSubscriberByProviderSubscriptionId,
	isWithinDunningGrace,
} from './services/subscriptions';
export { maybeAutoRecharge } from './services/auto-recharge';
export { webhookStats, checkWebhookRegistration } from './services/provider-health';
export type {
	IProviderWebhookStats,
	IWebhookRegistrationCheck,
	IWebhookRegistrationReport,
} from './services/provider-health';

// The catalog's prices and the provider's prices are two sources of truth for
// the same number. Same reason this is async and not a checkReadiness() hook:
// reading a price is a network call.
export { checkPriceConsistency, describePriceProblems } from './services/price-consistency';
export type {
	IPriceConsistencyEntry,
	IPriceConsistencyReport,
} from './services/price-consistency';

// The events each endpoint must be registered for — declared once here so a
// runbook, a setup script and this package cannot disagree about the list.
export {
	SUBSCRIPTION_WEBHOOK_EVENTS,
	SUBSCRIPTION_LIFECYCLE_EVENTS,
	SUBSCRIPTION_INVOICE_EVENTS,
	PAYMENT_WEBHOOK_EVENTS,
	ALL_WEBHOOK_EVENTS,
	isConsumedWebhookEvent,
} from './webhook-events';
export type {
	SubscriptionWebhookEvent,
	PaymentWebhookEvent,
	ConsumedWebhookEvent,
} from './webhook-events';
export {
	upsertWalletCustomer,
	claimAutoRecharge,
	recordRechargeSuccess,
	recordRechargeFailure,
} from './services/wallet-customers';
export type { IWalletCustomerKey, IAutoRechargeClaim } from './services/wallet-customers';

// Request validation — enforced contract for body-taking routes (webhook
// excluded: provider-shaped, signature-verified). Exported for docs/clients.
export * as schemas from './schemas';
