// ── Public API ───────────────────────────────────────────────────
export { BillingModule } from './module';
export { StripeProvider } from './providers/stripe';

// Middleware
export { requirePlan } from './middlewares/require-plan';
export { withBilling } from './middlewares/billing';

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
} from './dtos/billing';

// DTOs
export {
	toPlanDTO,
	toSubscriptionDTO,
	toWalletDTO,
	toWalletTransactionDTO,
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
	currentGrantPeriod,
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
export { getSubscription, getSubscriberByProviderSubscriptionId } from './services/subscriptions';
export { maybeAutoRecharge } from './services/auto-recharge';
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
