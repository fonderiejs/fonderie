// ── Public API ───────────────────────────────────────────────────
export { BillingModule }                              from './module';
export { StripeProvider }                             from './providers/stripe';
export { requirePlan }                                from './middlewares/require-plan';
export type { IBillingConfig, IBillingPlan }          from './config';
export type { IBillingProvider, IBillingEvent }       from './providers/types';
export type { IPlan, ISubscription, IUsageRecord,
              SubscriptionStatus }                    from './types';
export type { IPlanDTO, ISubscriptionDTO,
              IUsageRecordDTO }                       from './dtos/billing';

export { toPlanDTO, toSubscriptionDTO,
         toUsageRecordDTO }                           from './dtos/billing';
export { recordUsage, getUsage }                      from './services/usage';
export { getPlans, getPlanByName, getDBPlans,
         getPlanById, createPlan, updatePlan,
         deletePlan }                                 from './services/plans';
export { getSubscription }                            from './services/subscriptions';
