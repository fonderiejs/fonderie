import { queryStoreFor } from '@fonderie/client';
import type { IQueryEntry } from '@fonderie/client';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

// The one way a Fonderie hook reads server data (see @fonderie/client's
// query-store.ts for the rules). In short: what was fetched shows at once on
// every mount; a mount fetches only when the answer is missing or stale; a
// refresh happens behind the data, never instead of it; an unchanged answer
// changes nothing on screen.

export interface IUseClientQueryOptions {
	/** Override the client's staleness window for this read (ms). */
	staleMs?: number;
	/** false → do not fetch (e.g. no workspace selected yet). Default true. */
	enabled?: boolean;
}

export interface IClientQueryResult<T> {
	/** The last good answer — kept through refreshes and failures. */
	data: T | undefined;
	/** The last fetch's failure (null once one succeeds). Shown next to data, not instead of it. */
	error: unknown;
	/** Nothing to show yet: no answer and none failed (or a retry is running). */
	isLoading: boolean;
	/** A request is in flight — a refresh behind data shown. Not a reason for a spinner. */
	isFetching: boolean;
	/**
	 * Fetch now (pull-to-refresh, after a write) — always, whatever the
	 * staleness. `force` is handed to the fetcher (the HTTP cache's `bust`).
	 * Resolves with the data held after it.
	 */
	refresh: (opts?: { force?: boolean }) => Promise<T | undefined>;
}

const EMPTY: IQueryEntry = Object.freeze({ data: undefined, error: null, updatedAt: 0, isFetching: false });
const noop = () => {};

/**
 * @param source  the FonderieClient or sub-client the hook reads through
 * @param key     the query key — include everything the answer depends on
 *                (path, workspace, params); null = nothing to read
 * @param fetcher performs the request; `force` is what refresh() was asked
 *                (pass it on as the HTTP cache's `bust`) — false for reads
 *                the store starts itself
 */
export function useClientQuery<T>(
	source: object,
	key: string | null,
	fetcher: (ctx: { force: boolean }) => Promise<T>,
	opts: IUseClientQueryOptions = {},
): IClientQueryResult<T> {
	const store = queryStoreFor(source);
	const enabled = opts.enabled !== false && key !== null;
	// The latest fetcher, without making it a dependency: hooks pass inline
	// closures, and a new closure each render must not mean a new request.
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	const subscribe = useCallback(
		(onChange: () => void) => (key ? store.subscribe(key, onChange) : noop),
		[store, key],
	);
	const read = useCallback(() => (key ? store.peek<T>(key) : (EMPTY as IQueryEntry<T>)), [store, key]);
	const entry = useSyncExternalStore(subscribe, read, read);

	// Fetch when shown with a missing/stale answer, and again when a write
	// invalidates it (updatedAt drops to 0). NOT when a fetch merely finishes:
	// a failed fetch leaves the entry stale, and retrying on that would loop.
	// biome-ignore lint/correctness/useExhaustiveDependencies: updatedAt is the invalidation signal
	useEffect(() => {
		if (!enabled || !key) return;
		void store.fetch(key, () => fetcherRef.current({ force: false }), {
			...(opts.staleMs !== undefined ? { staleMs: opts.staleMs } : {}),
		});
	}, [enabled, key, store, entry.updatedAt, opts.staleMs]);

	// A disabled query refreshes nothing: a write made through a hook that was
	// told not to read (no id yet, or { read: false }) must not fetch the list
	// it was told to leave alone.
	const refresh = useCallback(
		async (o?: { force?: boolean }) => {
			if (!enabled || !key) return undefined;
			return store.fetch(key, () => fetcherRef.current({ force: o?.force === true }), { force: true });
		},
		[store, key, enabled],
	);

	const nothingToShow = entry.data === undefined;
	return {
		data: entry.data,
		error: entry.error,
		isLoading: enabled && nothingToShow && (entry.isFetching || entry.error == null),
		isFetching: entry.isFetching,
		refresh,
	};
}
