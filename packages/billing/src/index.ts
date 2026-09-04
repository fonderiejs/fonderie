// ── Public API ───────────────────────────────────────────────────
export { BillingModule } from './module';
export { StripeProvider } from './providers/stripe';

// Middleware
export { requirePlan } from './middlewares/require-plan';
export { withBilling } from './middlewares/billing';

// Helpers — sync, read from cached ctx.meta['billing']
export { hasFeature, getPlanLimit, getLimitStatus, requireFeature } from './helpers';

// Config + constants
export { MESSAGE_KEYS } from './config';
export type {
	IBillingConfig,
	IBillingCreditPack,
	IBillingPlan,
	IBillingPlanDefaults,
	IBillingPlanPrice,
	IBillingPricingConfig,
	IBillingWalletConfig,
	RateLimitBackendConfig,
	IBillingNotificationsConfig,
	BillingMessageKey,
} from './config';

// Backends
export { MemoryCounterBackend, DBCounterBackend } from './backends';
export type { ICounterBackend } from './backends';

export { BILLING_INTERVAL, WALLET_LEDGER_TYPES } from './types';
export type { BillingInterval, WalletLedgerType } from './types';
// Types
export type {
	IBillingProvider,
	IBillingEvent,
	INormalizedPayment,
	IResolvedPrice,
} from './providers/types';
export type {
	IPlan,
	ISubscription,
	IUsageRecord,
	IWalletBalance,
	IWalletLedgerEntry,
	SubscriptionStatus,
	PolicyEntry,
	LimitStatus,
	IPolicyStatus,
	IBillingContext,
} from './types';
export type {
	IPlanDTO,
	ISubscriptionDTO,
	IUsageRecordDTO,
	IWalletDTO,
	IWalletTransactionDTO,
} from './dtos/billing';

// DTOs
export {
	toPlanDTO,
	toSubscriptionDTO,
	toUsageRecordDTO,
	toWalletDTO,
	toWalletTransactionDTO,
} from './dtos/billing';

// Wallet — ledger-backed stored value. Product code debits through
// debitWallet with an idempotency key derived from its own unit of work.
export {
	creditWallet,
	debitWallet,
	getWalletBalance,
	getWalletLedger,
	ensurePeriodicGrant,
	currentGrantPeriod,
} from './services/wallet';
export type {
	IWalletSubscriber,
	IWalletMutationResult,
	IWalletLedgerPage,
	IGrantResult,
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
export { getSubscription } from './services/subscriptions';

// Request validation — enforced contract for body-taking routes (webhook
// excluded: provider-shaped, signature-verified). Exported for docs/clients.
export * as schemas from './schemas';
