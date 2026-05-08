// ── Public API ───────────────────────────────────────────────────
export { BillingModule }                              from './module';
export { StripeProvider }                             from './providers/stripe';
export { requirePlan }                                from './middlewares/require-plan';

export type { IBillingConfig, IBillingPlan }          from './config';
export type { IBillingProvider, IBillingEvent }       from './providers/types';
export type { IPlan, ISubscription, IUsageRecord, SubscriptionStatus } from './types';

export { recordUsage, getUsage }                      from './services/usage';
export { getPlans, getPlanByName }                    from './services/plans';
export { getSubscription }                            from './services/subscriptions';
