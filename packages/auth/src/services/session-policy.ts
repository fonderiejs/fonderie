// Session lifetimes per platform (docs/SESSION-DESIGN.md, Phase 3c).
//
// A phone in someone's pocket and a browser on a shared computer should not
// stay signed in equally long. The client declares its platform at SIGN-IN
// (header X-Client-Kind: mobile | desktop | web); it is recorded on the
// session and used at every refresh — a client cannot promote itself later.
//
// Each lifetime resolves, first match wins:
//   1. the console, for this platform   auth.session.duration.web
//   2. the console, shared              auth.session.duration
//   3. the app's code, for this platform  sessionPolicies.web
//   4. the app's code, shared           sessionDuration
//   5. the preset for this platform     SESSION_POLICY_PRESETS
//   6. the library default              90 d idle / 1 h access
// A client that declares nothing gets 2 → 4 → 6: today's behaviour.

import type { IAuthConfig, IAuthRuntimeConfig } from '../config';

export const CLIENT_KINDS = ['mobile', 'desktop', 'web'] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export interface ISessionPolicy {
	/** Idle timeout, sliding (e.g. '90d'). */
	sessionDuration?: string;
	/** Absolute cap from sign-in (e.g. '365d'). */
	sessionMaxAge?: string;
	/** Access-token lifetime (e.g. '1h'). */
	accessTokenDuration?: string;
}

/** Built-in defaults per platform; every value is overridable (see the order above). */
export const SESSION_POLICY_PRESETS: Readonly<Record<ClientKind, ISessionPolicy>> = {
	// Personal device; the token lives in the Keychain / Keystore.
	mobile: { sessionDuration: '90d', sessionMaxAge: '365d' },
	// Personal, but often a shared workstation.
	desktop: { sessionDuration: '30d', sessionMaxAge: '180d' },
	// Shared and public computers; cookies.
	web: { sessionDuration: '14d', sessionMaxAge: '90d' },
};

/** The platform a request declares, or null (undeclared or unknown values). */
export function clientKindOf(headers: Headers): ClientKind | null {
	const v = headers.get('x-client-kind')?.trim().toLowerCase();
	return (CLIENT_KINDS as readonly string[]).includes(v ?? '') ? (v as ClientKind) : null;
}

const FIELDS = ['sessionDuration', 'sessionMaxAge', 'accessTokenDuration'] as const;

/**
 * The config to issue tokens with for this platform: the app's config, its
 * runtime (console) values, and the lifetimes resolved in the order above.
 */
export function configForClient(
	config: IAuthConfig,
	runtime: Partial<IAuthRuntimeConfig> | undefined,
	kind: ClientKind | null,
): IAuthConfig {
	const rt = (runtime ?? {}) as Partial<IAuthRuntimeConfig> & ISessionPolicy;
	const code = config as IAuthConfig & ISessionPolicy;
	const out: IAuthConfig & ISessionPolicy = { ...config, ...rt };
	for (const field of FIELDS) {
		const value =
			(kind ? rt.sessionPolicies?.[kind]?.[field] : undefined) ??
			rt[field] ??
			(kind ? code.sessionPolicies?.[kind]?.[field] : undefined) ??
			code[field] ??
			(kind ? SESSION_POLICY_PRESETS[kind][field] : undefined);
		if (value === undefined) delete out[field];
		else out[field] = value;
	}
	return out;
}

/** Console keys for one platform's lifetimes. */
export function sessionPolicyConfigKeys(kind: ClientKind): Record<keyof ISessionPolicy, string> {
	return {
		sessionDuration: `auth.session.duration.${kind}`,
		sessionMaxAge: `auth.session.max_age.${kind}`,
		accessTokenDuration: `auth.access.duration.${kind}`,
	};
}

/**
 * Read auth's runtime config from the app's config store, safely: a key that
 * is not set yields undefined — never the text "undefined" that
 * `String(getConfig(...)) || undefined` produces (which once made every refresh
 * fail). Use it as `resolve: (ctx) => readAuthRuntimeConfig((key) => getConfig(ctx, key, undefined))`.
 */
export function readAuthRuntimeConfig(read: (key: string) => unknown): Partial<IAuthRuntimeConfig> {
	const text = (key: string) => {
		const v = read(key);
		return typeof v === 'string' && v.trim() ? v.trim() : undefined;
	};
	const bool = (key: string) => {
		const v = read(key);
		if (typeof v === 'boolean') return v;
		if (typeof v === 'string' && ['true', 'false'].includes(v.trim().toLowerCase())) return v.trim().toLowerCase() === 'true';
		return undefined;
	};
	const num = (key: string) => {
		const v = read(key);
		const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
		return Number.isFinite(n) ? n : undefined;
	};
	const out: Partial<IAuthRuntimeConfig> & ISessionPolicy = {};
	const set = <K extends string>(k: K, v: unknown) => {
		if (v !== undefined) (out as Record<string, unknown>)[k] = v;
	};
	set('sessionDuration', text('auth.session.duration'));
	set('sessionMaxAge', text('auth.session.max_age'));
	set('accessTokenDuration', text('auth.access.duration'));
	set('verificationCooldown', num('auth.verification.cooldown'));
	set('mfa', bool('auth.mfa.enabled'));
	set('requireVerification', bool('auth.verification.required'));
	const policies: Partial<Record<ClientKind, ISessionPolicy>> = {};
	for (const kind of CLIENT_KINDS) {
		const keys = sessionPolicyConfigKeys(kind);
		const policy: ISessionPolicy = {};
		for (const field of FIELDS) {
			const v = text(keys[field]);
			if (v !== undefined) policy[field] = v;
		}
		if (Object.keys(policy).length) policies[kind] = policy;
	}
	if (Object.keys(policies).length) out.sessionPolicies = policies;
	return out;
}
