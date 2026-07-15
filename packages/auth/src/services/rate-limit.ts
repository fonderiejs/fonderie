import type { Middleware } from '@fonderie/core';
import type { IStoreAdapter } from '@fonderie/store';
import {
	byBodyField,
	byIp,
	rateLimit,
	StoreAdapterStore,
	type IRateLimitRule,
	type IRateLimitStore,
} from '@fonderie/rate-limit';

// Per-route brute-force protection for auth. Defaults are deliberately
// conservative and, crucially, ON without the caller asking — the whole point
// of shipping this in the module is that "add login" gets throttling too.

export interface IAuthRateLimitConfig {
	// Override the backing store. Defaults to StoreAdapterStore over the
	// module's own IStoreAdapter — distributed-correct with zero extra infra.
	store?: IRateLimitStore;
	// Per-route rule overrides; set a route to false to disable just that one.
	rules?: Partial<Record<AuthLimitedRoute, IRateLimitRule | false>>;
}

export type AuthLimitedRoute = 'login' | 'register' | 'forgot' | 'mfaVerify';

// capacity = burst; refillPerSec = capacity / windowSeconds.
const min = (n: number) => n * 60;
const DEFAULTS: Record<AuthLimitedRoute, { ip: IRateLimitRule; id?: IRateLimitRule; idField?: string }> = {
	// login: 10/15min per IP AND 5/15min per account (credential stuffing
	// rotates IPs, so the per-account bucket is the one that bites).
	login: {
		ip: { capacity: 10, refillPerSec: 10 / min(15) },
		id: { capacity: 5, refillPerSec: 5 / min(15) },
		idField: 'email',
	},
	// register: 5/hour per IP — signup abuse is IP-shaped.
	register: { ip: { capacity: 5, refillPerSec: 5 / min(60) } },
	// forgot: 5/hour per IP AND 3/hour per account (email-bombing protection).
	forgot: {
		ip: { capacity: 5, refillPerSec: 5 / min(60) },
		id: { capacity: 3, refillPerSec: 3 / min(60) },
		idField: 'email',
	},
	// mfaVerify: 10/15min per IP — TOTP brute-force.
	mfaVerify: { ip: { capacity: 10, refillPerSec: 10 / min(15) } },
};

export function buildAuthLimiter(
	route: AuthLimitedRoute,
	store: IStoreAdapter,
	config: IAuthRateLimitConfig | false | undefined,
): Middleware | null {
	if (config === false) return null;

	const override = config?.rules?.[route];
	if (override === false) return null;

	const backing = config?.store ?? new StoreAdapterStore(store);
	const def = DEFAULTS[route];
	const ipRule = override ?? def.ip;

	const limits = [{ store: backing, rule: ipRule, key: byIp(`auth:${route}`) }];
	if (def.id && def.idField) {
		limits.push({ store: backing, rule: def.id, key: byBodyField(`auth:${route}`, def.idField) });
	}
	return rateLimit(...limits);
}
