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
//
// Two phases per route, wired at different points in the chain:
//   - IP limit runs BEFORE validate() — a cheap guard that sheds floods
//     before they reach schema parsing.
//   - Account (body-field) limit runs AFTER validate() — so it keys on a
//     bounded, well-typed identifier, never raw attacker input.

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
const DEFAULTS: Record<
	AuthLimitedRoute,
	{ ip: IRateLimitRule; account?: IRateLimitRule; accountField?: string }
> = {
	// login: 10/15min per IP AND 5/15min per account (credential stuffing
	// rotates IPs, so the per-account bucket is the one that bites).
	login: {
		ip: { capacity: 10, refillPerSec: 10 / min(15) },
		account: { capacity: 5, refillPerSec: 5 / min(15) },
		accountField: 'email',
	},
	// register: 5/hour per IP — signup abuse is IP-shaped.
	register: { ip: { capacity: 5, refillPerSec: 5 / min(60) } },
	// forgot: 5/hour per IP AND 3/hour per account (email-bombing protection).
	forgot: {
		ip: { capacity: 5, refillPerSec: 5 / min(60) },
		account: { capacity: 3, refillPerSec: 3 / min(60) },
		accountField: 'email',
	},
	// mfaVerify: 10/15min per IP — TOTP brute-force.
	mfaVerify: { ip: { capacity: 10, refillPerSec: 10 / min(15) } },
};

function resolve(
	route: AuthLimitedRoute,
	store: IStoreAdapter,
	config: IAuthRateLimitConfig | false | undefined,
): {
	store: IRateLimitStore;
	ipRule: IRateLimitRule;
	account?: { rule: IRateLimitRule; field: string };
} | null {
	if (config === false) return null;
	const override = config?.rules?.[route];
	if (override === false) return null;

	const backing = config?.store ?? new StoreAdapterStore(store);
	const def = DEFAULTS[route];
	return {
		store: backing,
		ipRule: override ?? def.ip,
		...(def.account && def.accountField
			? { account: { rule: def.account, field: def.accountField } }
			: {}),
	};
}

// Phase 1: IP limit, placed BEFORE validate().
export function buildAuthIpLimiter(
	route: AuthLimitedRoute,
	store: IStoreAdapter,
	config: IAuthRateLimitConfig | false | undefined,
): Middleware | null {
	const r = resolve(route, store, config);
	if (!r) return null;
	return rateLimit({ store: r.store, rule: r.ipRule, key: byIp(`auth:${route}`) });
}

// Phase 2: account limit, placed AFTER validate() so the keyed field is clean.
export function buildAuthAccountLimiter(
	route: AuthLimitedRoute,
	store: IStoreAdapter,
	config: IAuthRateLimitConfig | false | undefined,
): Middleware | null {
	const r = resolve(route, store, config);
	if (!r || !r.account) return null;
	return rateLimit({
		store: r.store,
		rule: r.account.rule,
		key: byBodyField(`auth:${route}`, r.account.field),
	});
}
