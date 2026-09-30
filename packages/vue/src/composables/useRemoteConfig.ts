import type { ConfigClient } from '@fonderie/client';
import type { Component, ComputedRef, MaybeRefOrGetter } from 'vue';
import { computed, defineComponent, getCurrentScope, h, onScopeDispose, shallowRef, toValue } from 'vue';

import { useFonderieSubClient } from '../provider';

// Remote config, read by key. ONE way to read it: this composable, or the
// wrapper below for a whole screen. Always live — the first reader opens the
// shared stream (@fonderie/sse) and loads; a change on the server updates
// exactly the readers whose key changed; the last reader closes the stream.
// There is no polling and nothing to opt into.
//
// Never waits on the network: the ref holds the current value at once — the
// last answer, the one restored from the device (FonderieClient
// `config.storage`), or `fallback`. Pick the SAFE fallback. A key the server
// does not expose is warned about once (see the client's `log`). `key` may be
// a ref or getter.
//
//   const message = useRemoteConfig('MAINTENANCE_MESSAGE', '');

export function useRemoteConfig<T>(key: MaybeRefOrGetter<string>, fallback: T, client?: ConfigClient): ComputedRef<T> {
	const config = useFonderieSubClient(client, (c) => c.config, 'useRemoteConfig');
	const snapshot = shallowRef(config.snapshot());
	const unsubscribe = config.subscribe((next) => {
		snapshot.value = next;
	});
	const release = config.retain();
	if (getCurrentScope()) {
		onScopeDispose(() => {
			unsubscribe();
			release();
		});
	}
	// A computed only notifies when its value changes, so a change to another
	// key does not update this reader.
	return computed(() => {
		void snapshot.value;
		return config.get(toValue(key), fallback);
	});
}

export interface IWithRemoteConfigOptions {
	/** Rendered instead while the key is off — e.g. a "coming soon" screen. Default: nothing. */
	off?: Component | null;
	/** Used while the key has no value. Default false: an unknown switch stays off. */
	fallback?: boolean;
}

/**
 * Render `component` only while the boolean key `key` is on; otherwise `off`.
 * Props, attrs and slots pass through. Live: flipping the key re-renders at once.
 *
 *   export default withRemoteConfig('WITH_JOBS_SCREEN', JobsScreen, { off: ComingSoon, fallback: true });
 */
export function withRemoteConfig(key: string, component: Component, options: IWithRemoteConfigOptions = {}): Component {
	const { off = null, fallback = false } = options;
	const inner = (component as { name?: string; __name?: string }).name ?? (component as { __name?: string }).__name ?? 'Component';
	return defineComponent({
		name: `WithRemoteConfig(${key}, ${inner})`,
		inheritAttrs: false,
		setup(_, { attrs, slots }) {
			const on = useRemoteConfig<boolean>(key, fallback);
			return () => (on.value ? h(component, attrs, slots) : off ? h(off, attrs, slots) : null);
		},
	});
}
