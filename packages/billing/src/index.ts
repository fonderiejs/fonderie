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
	IBillingPlan,
	IBillingPlanDefaults,
	RateLimitBackendConfig,
	IBillingNotificationsConfig,
	BillingMessageKey,
} from './config';

// Backends
export { MemoryCounterBackend, DBCounterBackend } from './backends';
export type { ICounterBackend } from './backends';

// Types
export type { IBillingProvider, IBillingEvent } from './providers/types';
export type {
	IPlan,
	ISubscription,
	IUsageRecord,
	SubscriptionStatus,
	PolicyEntry,
	LimitStatus,
	IPolicyStatus,
	IBillingContext,
} from './types';
export type { IPlanDTO, ISubscriptionDTO, IUsageRecordDTO } from './dtos/billing';

// DTOs
export { toPlanDTO, toSubscriptionDTO, toUsageRecordDTO } from './dtos/billing';

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
