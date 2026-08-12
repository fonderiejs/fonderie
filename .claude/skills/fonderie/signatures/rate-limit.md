<!-- GENERATED — do not edit. Regenerate with: npm run docs:signatures -->

# @fonderie/rate-limit — signatures

## @fonderie/rate-limit

Subpath exports: `@fonderie/rate-limit/migrations`

```ts
interface IRateLimitRule {
    capacity: number;
    refillPerSec: number;
    cost?: number;
}

interface IConsumeResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

interface IRateLimitStore {
    consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult>;
}

interface IRedisEvalClient {
    eval(script: string, numKeys: number, ...keysAndArgs: (string | number)[]): Promise<unknown>;
}

function rateLimit(...limits: IRateLimitOptions[]): Middleware

function byIp(scope: string): KeyFn

function byBodyField(scope: string, field: string): KeyFn

interface IRateLimitOptions {
    store: IRateLimitStore;
    rule: IRateLimitRule;
    key: KeyFn;
    failClosed?: boolean;
}

type KeyFn = (ctx: IFonderieContext) => string | null;

new MemoryStore(): MemoryStore
  .consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult>
  .size: number

new StoreAdapterStore(store: IStoreAdapter): StoreAdapterStore
  .consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult>

new RedisStore(client: IRedisEvalClient, keyPrefix?: string): RedisStore
  .consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult>

function consumeFromBucket(state: IBucketState | null, rule: IRateLimitRule, nowMs: number): { next: IBucketState; result: IConsumeResult; }

function fullRefillMs(rule: IRateLimitRule): number

interface IBucketState {
    tokens: number;
    lastRefillMs: number;
}
```
