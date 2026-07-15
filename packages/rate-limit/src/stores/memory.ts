import { consumeFromBucket, fullRefillMs, type IBucketState } from '../bucket';
import type { IConsumeResult, IRateLimitRule, IRateLimitStore } from '../types';

// Single-instance store. Atomic by virtue of the single-threaded event loop —
// consume() does no awaiting between read and write. Correct for one process;
// use StoreAdapterStore or RedisStore when running multiple instances.

export class MemoryStore implements IRateLimitStore {
	private buckets = new Map<string, IBucketState>();
	private ops = 0;

	// Sweep lazily every N operations rather than on a timer, so the store
	// holds no open handle that keeps short-lived processes (tests, CLIs) alive.
	private static SWEEP_EVERY = 1024;

	async consume(key: string, rule: IRateLimitRule): Promise<IConsumeResult> {
		const now = Date.now();
		const { next, result } = consumeFromBucket(this.buckets.get(key) ?? null, rule, now);
		this.buckets.set(key, next);

		if (++this.ops % MemoryStore.SWEEP_EVERY === 0) this.sweep(rule, now);
		return result;
	}

	private sweep(rule: IRateLimitRule, nowMs: number): void {
		const idleMs = fullRefillMs(rule);
		for (const [key, state] of this.buckets) {
			// A bucket idle long enough to be full again is indistinguishable
			// from an absent one — drop it.
			if (nowMs - state.lastRefillMs > idleMs) this.buckets.delete(key);
		}
	}

	// Test/ops introspection.
	get size(): number {
		return this.buckets.size;
	}
}
