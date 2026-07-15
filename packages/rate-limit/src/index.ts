// ── Public API ───────────────────────────────────────────────────
export type {
	IRateLimitRule,
	IConsumeResult,
	IRateLimitStore,
	IRedisEvalClient,
} from './types';

export { rateLimit, byIp, byBodyField } from './middleware';
export type { IRateLimitOptions, KeyFn } from './middleware';

export { MemoryStore } from './stores/memory';
export { StoreAdapterStore } from './stores/store-adapter';
export { RedisStore } from './stores/redis';

// Pure bucket math — exported for tests and custom stores.
export { consumeFromBucket, fullRefillMs } from './bucket';
export type { IBucketState } from './bucket';
