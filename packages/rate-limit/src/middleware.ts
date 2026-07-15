import type { IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';

import type { IRateLimitRule, IRateLimitStore } from './types';

// Key extractors. A limiter guards a scarce thing — name it in the key so
// two limiters on the same route can't collide.

export type KeyFn = (ctx: IFonderieContext) => string | null;

// Client IP, as resolved by the adapter into ctx.meta['clientIp'] (see
// @fonderie/adapter-* — trust-proxy aware). Returns null when unavailable,
// which skips this limiter rather than collapsing every request onto one key.
export function byIp(scope: string): KeyFn {
	return (ctx) => {
		const ip = ctx.meta['clientIp'];
		return typeof ip === 'string' && ip.length > 0 ? `${scope}:ip:${ip}` : null;
	};
}

// A field of the (already-validated) request body — e.g. the login email —
// normalized so "Jane@x.com" and "jane@x.com " share a bucket.
export function byBodyField(scope: string, field: string): KeyFn {
	return (ctx) => {
		const body = ctx.meta['body'] as Record<string, unknown> | undefined;
		const v = body?.[field];
		return typeof v === 'string' && v.length > 0
			? `${scope}:${field}:${v.trim().toLowerCase()}`
			: null;
	};
}

export interface IRateLimitOptions {
	store: IRateLimitStore;
	rule: IRateLimitRule;
	key: KeyFn;
	// Fail-open (default) keeps auth available when the store is down —
	// an outage shouldn't lock every user out. Flip for fail-closed.
	failClosed?: boolean;
}

// One or more limits guarding a route; ALL must allow. Emits the IETF
// draft-ietf-httpapi-ratelimit-headers fields on the 429 (RateLimit-Limit /
// -Remaining / -Reset in seconds, plus Retry-After).
export function rateLimit(...limits: IRateLimitOptions[]): Middleware {
	return async (ctx, next) => {
		for (const limit of limits) {
			const key = limit.key(ctx);
			if (key === null) continue;

			let result: Awaited<ReturnType<IRateLimitStore['consume']>>;
			try {
				result = await limit.store.consume(key, limit.rule);
			} catch {
				if (limit.failClosed) {
					return setApiResponse(
						HTTP.TOO_MANY_REQUESTS,
						'RATE_LIMITED',
						'Rate limiter unavailable. Please try again later.',
					);
				}
				continue; // fail-open
			}

			if (!result.allowed) {
				const resetSec = Math.ceil(result.retryAfterMs / 1000);
				const res = setApiResponse(
					HTTP.TOO_MANY_REQUESTS,
					'RATE_LIMITED',
					'Too many requests. Please try again later.',
					{ retryAfter: resetSec },
				);
				res.headers.set('RateLimit-Limit', String(limit.rule.capacity));
				res.headers.set('RateLimit-Remaining', '0');
				res.headers.set('RateLimit-Reset', String(resetSec));
				res.headers.set('Retry-After', String(resetSec));
				return res;
			}
		}
		return next();
	};
}
