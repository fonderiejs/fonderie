import { createHash } from 'node:crypto';

import type { IFonderieContext, Middleware } from '@fonderie/core';
import { HTTP, setApiResponse } from '@fonderie/core';

import type { IRateLimitRule, IRateLimitStore } from './types';

// Key extractors. A limiter guards a scarce thing — name it in the key so
// two limiters on the same route can't collide.
//
// Every key is hashed to a fixed-width digest before it reaches a store:
//   - bounds key size (an attacker can't blow up storage with 10KB "emails")
//   - keeps user identifiers (emails, IPs) OUT of the rate-limit table as
//     plaintext — no PII to leak or to forget under a deletion request
// The `scope` prefix stays readable so operators can eyeball which limiter a
// key belongs to; only the identifying tail is digested.

export type KeyFn = (ctx: IFonderieContext) => string | null;

function hashed(scope: string, ...parts: string[]): string {
	const h = createHash('sha256').update(parts.join('\0')).digest('base64url');
	return `${scope}:${h}`;
}

// Client IP, as resolved by the adapter into ctx.meta['clientIp'] (see
// resolveClientIp in @fonderie/core/middlewares — trust-proxy aware). Returns
// null when unavailable, which skips this limiter rather than collapsing every
// request onto one shared key.
//
// IPv6 is keyed on the /64 prefix, not the full address: a single residential
// IPv6 allocation is a /64 (2^64 addresses), so per-exact-address limiting is
// trivially bypassed. IPv4 keys on the full address.
export function byIp(scope: string): KeyFn {
	return (ctx) => {
		const ip = ctx.meta['clientIp'];
		if (typeof ip !== 'string' || ip.length === 0) return null;
		return hashed(`${scope}:ip`, ipv6Prefix(ip));
	};
}

// Collapse an IPv6 address to its /64 network prefix; pass IPv4 through.
function ipv6Prefix(ip: string): string {
	if (!ip.includes(':')) return ip; // IPv4
	// Expand omitted groups enough to take the first four (the /64 network).
	const [head] = ip.split('%'); // strip zone id
	const groups = head!.split('::');
	let left = groups[0] ? groups[0].split(':') : [];
	let right = groups[1] ? groups[1].split(':') : [];
	if (groups.length === 2) {
		const fill = 8 - left.length - right.length;
		left = [...left, ...Array(Math.max(0, fill)).fill('0'), ...right];
	}
	return left.slice(0, 4).join(':') + '::/64';
}

// A field of the request body — e.g. the login email — normalized so
// "Jane@x.com" and "jane@x.com " share a bucket, then hashed.
//
// SECURITY: place this limiter AFTER validate() in the route chain so the
// field is a bounded, well-typed string before it becomes a key. On an
// unvalidated body a caller could submit huge or non-string values; the
// length guard below is a backstop, not the primary control.
export function byBodyField(scope: string, field: string): KeyFn {
	return (ctx) => {
		const body = ctx.meta['body'] as Record<string, unknown> | undefined;
		const v = body?.[field];
		if (typeof v !== 'string' || v.length === 0) return null;
		// Backstop cap: an oversized value can't reach the hash unbounded.
		const normalized = v.slice(0, 320).trim().toLowerCase();
		if (normalized.length === 0) return null;
		return hashed(`${scope}:${field}`, normalized);
	};
}

export interface IRateLimitOptions {
	store: IRateLimitStore;
	rule: IRateLimitRule;
	key: KeyFn;
	// Fail-open (default) keeps auth available when the store is down —
	// an outage shouldn't lock every user out. Flip to fail-closed for
	// endpoints where an unthrottled request is worse than a rejected one.
	// This is a deliberate availability-over-strictness default; see the
	// package README § Fail-open.
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
