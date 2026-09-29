import type { ConfigClient, IRemoteConfigState } from '@fonderie/client';
import type { ComputedRef, Ref } from 'vue';
import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { useFonderieSubClient } from '../provider';

export interface IUseRemoteConfigOptions {
	/** Re-load every N ms while the component is alive (e.g. 300_000). Default: load once. */
	refreshMs?: number;
	/**
	 * Re-load when the server pushes a change (@fonderie/sse), while alive.
	 * Additive: without a stream it does nothing and refreshMs keeps working.
	 */
	watch?: boolean;
}

export interface IUseRemoteConfigReturn {
	state: Readonly<Ref<IRemoteConfigState>>;
	values: ComputedRef<Readonly<Record<string, unknown>>>;
	isLoading: ComputedRef<boolean>;
	error: ComputedRef<unknown>;
	/** Re-fetch now — e.g. right after sign-in, when values may be per-user. */
	refresh: () => Promise<IRemoteConfigState>;
}

// The app's public remote config (ConfigModule `publicKeys`), from ONE snapshot
// shared by every component: the first composable loads it, the rest read the
// same values and update together when they change.
export function useRemoteConfig(options: IUseRemoteConfigOptions = {}, client?: ConfigClient): IUseRemoteConfigReturn {
	const config = useFonderieSubClient(client, (c) => c.config, 'useRemoteConfig');
	const state = shallowRef(config.snapshot());
	const unsubscribe = config.subscribe((next) => {
		state.value = next;
	});

	const s = config.snapshot();
	if (!s.loadedAt && !s.isLoading) void config.load();

	const timer =
		options.refreshMs && options.refreshMs > 0 ? setInterval(() => void config.load(), options.refreshMs) : undefined;

	const stopWatch = options.watch ? config.watch() : undefined;

	if (getCurrentScope()) {
		onScopeDispose(() => {
			unsubscribe();
			if (timer) clearInterval(timer);
			stopWatch?.();
		});
	}

	return {
		state,
		values: computed(() => state.value.values),
		isLoading: computed(() => state.value.isLoading),
		error: computed(() => state.value.error),
		refresh: () => config.load(),
	};
}

// One flag or setting, as a computed ref. `fallback` renders before the first
// load, when loading failed, or when the key is not exposed. For a sub-feature
// pass the SAFE value (off); for a whole SCREEN fall back to showing it and
// seed saved values with client.config.hydrate() — a screen must never be
// unavailable for lack of signal (docs/REALTIME-DESIGN.md §4.7). `key` may be
// a ref or getter.
//
//   const showJobs = useFlag('ENABLE_JOB_LISTING', false);
export function useFlag<T>(key: MaybeRefOrGetter<string>, fallback: T, client?: ConfigClient): ComputedRef<T> {
	const config = useFonderieSubClient(client, (c) => c.config, 'useFlag');
	const { state } = useRemoteConfig({}, config);
	return computed(() => {
		void state.value; // track the shared snapshot
		return config.get(toValue(key), fallback);
	});
}
