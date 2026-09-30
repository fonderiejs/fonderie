import { type ConfigClient, isSwitchOn } from '@fonderie/client';
import { type ComponentType, createElement, useCallback, useEffect, useSyncExternalStore } from 'react';

import { useFonderieSubClient } from '../provider';

// Remote config, read by key. ONE way to read it: this hook, or the HOC below
// for a whole screen. Always live — the first mounted reader opens the shared
// stream (@fonderie/sse) and loads; a change on the server re-renders exactly
// the components whose key changed; the last reader closes the stream. There
// is no polling and nothing to opt into.
//
// Never waits on the network: it returns the current value at once — the last
// answer, the one restored from the device (FonderieClient `config.storage`),
// or `fallback`. Pick the SAFE fallback. A key the server does not expose is
// warned about once (see the client's `log`).

const MISSING = Symbol('missing');

export function useRemoteConfig<T>(key: string, fallback: T, client?: ConfigClient): T {
	const config = useFonderieSubClient(client, (c) => c.config, 'useRemoteConfig');
	const value = useSyncExternalStore(
		useCallback((onChange: () => void) => config.subscribe(onChange), [config]),
		// Only this key's value decides a re-render, so a change elsewhere in the
		// config does not re-render this component.
		() => {
			const values = config.snapshot().values;
			return Object.hasOwn(values, key) ? values[key] : MISSING;
		},
		() => {
			const values = config.snapshot().values;
			return Object.hasOwn(values, key) ? values[key] : MISSING;
		},
	);
	useEffect(() => config.retain(), [config]);
	return value === MISSING ? config.get(key, fallback) : (value as T);
}

export interface IWithRemoteConfigOptions<P> {
	/** Rendered instead while the key is off — e.g. a "coming soon" screen. Default: nothing. */
	off?: ComponentType<P> | null;
	/** Used while the key has no value. Default false: an unknown switch stays off. */
	fallback?: boolean;
}

/**
 * Render `Component` only while the switch `key` is on (isSwitchOn: false, 0,
 * '', "false", "off", "0", "no" are off); otherwise `off`.
 * Live like useRemoteConfig: flipping the key re-renders the screen at once.
 *
 *   export default withRemoteConfig('WITH_JOBS_SCREEN', JobsScreen, { off: ComingSoon, fallback: true });
 */
export function withRemoteConfig<P extends object>(
	key: string,
	Component: ComponentType<P>,
	options: IWithRemoteConfigOptions<P> = {},
): ComponentType<P> {
	const { off = null, fallback = false } = options;
	function WithRemoteConfig(props: P) {
		const on = isSwitchOn(useRemoteConfig<unknown>(key, fallback));
		if (on) return createElement(Component, props);
		return off ? createElement(off, props) : null;
	}
	WithRemoteConfig.displayName = `withRemoteConfig(${key}, ${Component.displayName ?? Component.name ?? 'Component'})`;
	return WithRemoteConfig;
}
