import type { IConsumeResult, IRateLimitRule } from './types';

// Pure token-bucket math, shared by every store: given the persisted state
// (tokens, lastRefillMs) and the current time, refill then try to consume.
// Stores are responsible only for applying this atomically.

export interface IBucketState {
	tokens: number;
	lastRefillMs: number;
}

export function consumeFromBucket(
	state: IBucketState | null,
	rule: IRateLimitRule,
	nowMs: number,
): { next: IBucketState; result: IConsumeResult } {
	const cost = rule.cost ?? 1;
	const prevTokens = state ? state.tokens : rule.capacity;
	const prevRefill = state ? state.lastRefillMs : nowMs;

	const elapsedSec = Math.max(0, nowMs - prevRefill) / 1000;
	const refilled = Math.min(rule.capacity, prevTokens + elapsedSec * rule.refillPerSec);

	if (refilled >= cost) {
		const tokens = refilled - cost;
		return {
			next: { tokens, lastRefillMs: nowMs },
			result: { allowed: true, remaining: Math.floor(tokens), retryAfterMs: 0 },
		};
	}

	const deficit = cost - refilled;
	const retryAfterMs = Math.ceil((deficit / rule.refillPerSec) * 1000);
	return {
		next: { tokens: refilled, lastRefillMs: nowMs },
		result: { allowed: false, remaining: 0, retryAfterMs },
	};
}

// How long until a full (idle) bucket forgets a key entirely — used by
// stores for expiry so old keys don't accumulate forever.
export function fullRefillMs(rule: IRateLimitRule): number {
	return Math.ceil((rule.capacity / rule.refillPerSec) * 1000);
}
