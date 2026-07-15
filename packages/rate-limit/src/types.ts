// One atomic operation is the whole store contract: refill the bucket by
// elapsed time, then attempt to take `cost` tokens. Everything else —
// middleware, headers, keying — derives from it. Implementations MUST make
// consume() atomic across concurrent callers (and across processes for
// shared-store implementations); two racing consumers must never both be
// granted the last token.

export interface IRateLimitRule {
	// Bucket capacity — the burst size. A fresh key can spend this many
	// tokens instantly.
	capacity: number;
	// Steady-state refill rate. capacity=10, refillPerSec=10/900 ≈ "10 per
	// 15 minutes with bursts of 10".
	refillPerSec: number;
	// Tokens taken per request. Default 1.
	cost?: number;
}

export interface IConsumeResult {
	allowed: boolean;
	// Tokens left after this consume (0 when denied).
	remaining: number;
	// Milliseconds until at least `cost` tokens are available again.
	// 0 when allowed and tokens remain.
	retryAfterMs: number;
}

export interface IRateLimitStore {
	consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult>;
}

// Structural Redis client — satisfied by ioredis and node-redis without this
// package depending on either. Same pattern as core's IRequestSchema.
export interface IRedisEvalClient {
	eval(script: string, numKeys: number, ...keysAndArgs: (string | number)[]): Promise<unknown>;
}
