import type { Middleware } from '@fonderie/core';
import { setApiResponse, HTTP } from '@fonderie/core';

import type { RemoteConfigManager } from './manager';

/**
 * Which config keys a frontend may read, and optionally the value to report
 * when a key has not been set yet.
 *
 *   publicKeys: ['ENABLE_JOB_LISTING']                 // unset keys are omitted
 *   publicKeys: { ENABLE_JOB_LISTING: false }          // unset keys report false
 *
 * Nothing is public unless listed here: config also holds settings that are
 * nobody's business outside the server, and secrets live in a separate table
 * this route never reads.
 */
export type PublicConfigKeys = readonly string[] | Readonly<Record<string, unknown>>;

export interface IPublicConfigResult {
	/** key → value for every public key that is set (or has a default). */
	values: Record<string, unknown>;
}

/** The public subset of the current config snapshot. Pure; no I/O. */
export function publicConfigValues(
	manager: Pick<RemoteConfigManager, 'get'>,
	publicKeys: PublicConfigKeys | undefined,
): Record<string, unknown> {
	if (!publicKeys) return {};
	const withDefaults = !Array.isArray(publicKeys);
	const keys = withDefaults ? Object.keys(publicKeys) : (publicKeys as readonly string[]);
	const values: Record<string, unknown> = {};
	const unset = Symbol('unset');
	for (const key of keys) {
		const value = manager.get<unknown>(key, unset);
		if (value !== unset) values[key] = value;
		else if (withDefaults) values[key] = (publicKeys as Record<string, unknown>)[key];
	}
	return values;
}

/**
 * GET /config/public — unauthenticated by design: a sign-in or marketing
 * screen may need a flag before anyone has signed in. Served from the
 * in-memory snapshot (no database round trip per request). `no-store`, so a
 * browser or CDN never serves a flag after it was switched off — and so the
 * route stays correct when values become per-user.
 */
export function publicConfigHandler(
	manager: Pick<RemoteConfigManager, 'get'>,
	publicKeys: PublicConfigKeys | undefined,
): Middleware {
	return async () => {
		const res = setApiResponse(HTTP.OK, 'PUBLIC_CONFIG_FETCHED', 'Public config retrieved.', {
			values: publicConfigValues(manager, publicKeys),
		} satisfies IPublicConfigResult);
		res.headers.set('cache-control', 'no-store');
		return res;
	};
}
