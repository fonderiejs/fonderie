import type { ISseClientEvent, SseClient, SseStatus } from '@fonderie/client';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { useFonderieSubClient } from '../provider';

export interface IUseSseOptions {
	/** The stream (re)connected — refetch what you show; events may have been missed. */
	onReset?: () => void;
}

// Server-Sent Events from @fonderie/sse while the component is mounted.
// `topics`: '*', exact event types, or 'prefix.*'. All components share the
// client's single connection. Events are invalidations (ids only): refetch
// what changed. Never gate rendering on this — it is additive.
//
//   useSse(['fonderie.customer.*'], () => refetchCustomers(), { onReset: refetchCustomers });
export function useSse(
	topics: string[],
	onEvent: (event: ISseClientEvent) => void,
	options: IUseSseOptions = {},
	client?: SseClient,
): void {
	const sse = useFonderieSubClient(client, (c) => c.sse, 'useSse');
	// Latest callbacks without re-subscribing on every render.
	const handlers = useRef({ onEvent, onReset: options.onReset });
	handlers.current = { onEvent, onReset: options.onReset };
	const key = [...topics].sort().join(',');
	useEffect(
		() =>
			sse.subscribe(key ? key.split(',') : ['*'], (e) => handlers.current.onEvent(e), {
				onReset: () => handlers.current.onReset?.(),
			}),
		[sse, key],
	);
}

// The shared connection's state: 'open' while events flow; 'unavailable' when
// the runtime cannot stream or the server has no SSE (polling carries on).
// For a "live" indicator — never to gate rendering.
export function useSseStatus(client?: SseClient): SseStatus {
	const sse = useFonderieSubClient(client, (c) => c.sse, 'useSseStatus');
	return useSyncExternalStore(
		useCallback((onChange: () => void) => sse.onStatus(onChange), [sse]),
		() => sse.status,
		() => sse.status,
	);
}
