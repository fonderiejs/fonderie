import type { ISseClientEvent, SseClient, SseStatus } from '@fonderie/client';
import { getCurrentScope, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import { useFonderieSubClient } from '../provider';

export interface IUseSseOptions {
	/** The stream (re)connected — refetch what you show; events may have been missed. */
	onReset?: () => void;
}

// Server-Sent Events from @fonderie/sse while the component is alive.
// `topics` (may be a ref/getter): '*', exact event types, or 'prefix.*'. All
// components share the client's single connection. Events are invalidations
// (ids only). Never gate rendering on this — it is additive.
export function useSse(
	topics: MaybeRefOrGetter<string[]>,
	onEvent: (event: ISseClientEvent) => void,
	options: IUseSseOptions = {},
	client?: SseClient,
): void {
	const sse = useFonderieSubClient(client, (c) => c.sse, 'useSse');
	let stop: (() => void) | undefined;
	const stopWatch = watch(
		() => [...toValue(topics)].sort().join(','),
		(key) => {
			stop?.();
			stop = sse.subscribe(key ? key.split(',') : ['*'], onEvent, { onReset: () => options.onReset?.() });
		},
		{ immediate: true },
	);
	if (getCurrentScope()) {
		onScopeDispose(() => {
			stopWatch();
			stop?.();
		});
	}
}

// The shared connection's state, as a ref — for a "live" indicator, never to
// gate rendering ('unavailable' means polling carries on).
export function useSseStatus(client?: SseClient): Readonly<Ref<SseStatus>> {
	const sse = useFonderieSubClient(client, (c) => c.sse, 'useSseStatus');
	const status = shallowRef<SseStatus>(sse.status);
	const off = sse.onStatus((next) => {
		status.value = next;
	});
	if (getCurrentScope()) onScopeDispose(off);
	return status;
}
