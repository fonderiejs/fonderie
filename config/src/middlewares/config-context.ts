import type { Middleware }         from '@fonderie-js/core';

import type { RemoteConfigManager } from '../manager';

import { CONFIG_MANAGER_KEY }       from '../manager';

// Injects the config manager into ctx.meta
// so handlers can read config values per-request

export function configContextMiddleware(manager: RemoteConfigManager): Middleware {
	return async (ctx, next) => {
		ctx.meta[CONFIG_MANAGER_KEY] = manager;
		return next();
	}
}

// Helper to read config from ctx inside a handler
export function getConfig(
	ctx: { meta: Record<string, unknown> },
	key: string,
	fallback: unknown = null,
): unknown {
	const manager = ctx.meta[CONFIG_MANAGER_KEY] as RemoteConfigManager | undefined
	if (!manager) {
		return fallback;
	}

	return manager.get(key, fallback);
}
