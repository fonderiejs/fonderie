import type { ConfigClient, IRemoteConfigState } from '@fonderie/client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useFonderieSubClient } from '../provider';

export interface IUseRemoteConfigOptions {
	/** Re-load every N ms while mounted (e.g. 300_000). Default: load once. */
	refreshMs?: number;
	/**
	 * Re-load when the server pushes a change (@fonderie/sse), while mounted.
	 * Additive: without a stream it does nothing and refreshMs keeps working.
	 */
	watch?: boolean;
}

export interface IUseRemoteConfigReturn extends IRemoteConfigState {
	/** Re-fetch now — e.g. right after sign-in, when values may be per-user. */
	refresh: () => Promise<IRemoteConfigState>;
}

// The app's public remote config (ConfigModule `publicKeys`), from ONE snapshot
// shared by every component: the first mounted hook loads it, the rest read
// the same values and re-render together when they change. Works in React and
// React Native alike — it touches no DOM API.
export function useRemoteConfig(options: IUseRemoteConfigOptions = {}, client?: ConfigClient): IUseRemoteConfigReturn {
	const config = useFonderieSubClient(client, (c) => c.config, 'useRemoteConfig');
	const state = useSyncExternalStore(
		useCallback((onChange: () => void) => config.subscribe(onChange), [config]),
		() => config.snapshot(),
		() => config.snapshot(),
	);

	useEffect(() => {
		const s = config.snapshot();
		if (!s.loadedAt && !s.isLoading) void config.load();
	}, [config]);

	const { refreshMs } = options;
	useEffect(() => {
		if (!refreshMs || refreshMs <= 0) return;
		const timer = setInterval(() => void config.load(), refreshMs);
		return () => clearInterval(timer);
	}, [config, refreshMs]);

	const { watch } = options;
	useEffect(() => (watch ? config.watch() : undefined), [config, watch]);

	const refresh = useCallback(() => config.load(), [config]);
	return { ...state, refresh };
}

// One flag or setting. `fallback` is what renders before the first load, when
// loading failed, or when the server does not expose the key.
//   - A sub-feature (a button, a banner): pass the SAFE value (off) — it is
//     better to appear a moment late than to appear and vanish.
//   - A whole SCREEN: fall back to showing it, and seed saved values with
//     client.config.hydrate() — a screen must never be unavailable because
//     there is no signal (docs/REALTIME-DESIGN.md §4.7).
//
//   const showJobs = useFlag('ENABLE_JOB_LISTING', false);
export function useFlag<T>(key: string, fallback: T, client?: ConfigClient): T {
	const config = useFonderieSubClient(client, (c) => c.config, 'useFlag');
	useRemoteConfig({}, config);
	return config.get(key, fallback);
}
