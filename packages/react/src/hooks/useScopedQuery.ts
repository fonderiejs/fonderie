import { FonderieApiError, queryStoreFor } from '@fonderie/client';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useWorkspaceId } from '../provider';
import { useClientQuery } from './useClientQuery';

// The read every Fonderie hook package makes: one GET, keyed by its path and —
// for data that belongs to the selected workspace — by that workspace, through
// the client's shared store (useClientQuery). So a screen shown again opens on
// its data, a refresh happens behind the data, an unchanged answer changes
// nothing, a write under the same resource refreshes it everywhere, and a
// workspace switch reads the other workspace's entry without ever showing the
// previous one's data.

export interface IScopedQueryOptions<T> {
	/** Map an error that is a normal state (404 = none, 501 = provider can't say) to the data to show. */
	normal?: (err: FonderieApiError) => T | undefined;
	/** false for reads that do not depend on the selected workspace (a catalog, the user's own list). */
	perWorkspace?: boolean;
	/** false → do not read yet (e.g. a required id is still empty). */
	enabled?: boolean;
}

export interface IScopedQuery<T> {
	data: T | undefined;
	/** Nothing to show yet — never true while a refresh runs behind data. */
	isLoading: boolean;
	error: FonderieApiError | null;
	/** Fetch now (pull-to-refresh, after a write); `force` also bypasses the HTTP cache. */
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** Adopt an answer a write returned, so every screen shows it without a request. */
	adopt: (data: T) => void;
	/** The store key (changes with the workspace). */
	key: string;
}

export function toApiError(err: unknown): FonderieApiError {
	return err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
}

/**
 * @param source the sub-client read through (its workspace scope keys the read)
 * @param path   the GET path — the key starts with it, so any write under the
 *               same resource (`/workspaces/…`, `/billing/…`) marks it stale
 * @param read   performs the request; `bust` is true on an explicit refresh
 */
export function useScopedQuery<T>(
	source: object,
	path: string,
	read: (bust: boolean) => Promise<T>,
	opts: IScopedQueryOptions<T> = {},
): IScopedQuery<T> {
	const workspaceId = useWorkspaceId(source);
	const key = `GET ${path}::ws=${opts.perWorkspace === false ? '' : (workspaceId ?? '')}`;
	const normal = opts.normal;
	const q = useClientQuery<T>(
		source,
		key,
		async ({ force }) => {
			try {
				return await read(force);
			} catch (err) {
				const apiError = toApiError(err);
				const asData = normal?.(apiError);
				if (asData !== undefined) return asData;
				throw apiError;
			}
		},
		{ ...(opts.enabled !== undefined ? { enabled: opts.enabled } : {}) },
	);
	const store = queryStoreFor(source);
	const refresh = useCallback(
		async (o?: { force?: boolean }) => {
			await q.refresh(o);
		},
		[q.refresh],
	);
	const adopt = useCallback((data: T) => store.set(key, data), [store, key]);
	return {
		data: q.data,
		isLoading: q.isLoading,
		error: q.error == null ? null : toApiError(q.error),
		refresh,
		adopt,
		key,
	};
}

/**
 * The write side every hook repeats: run a write, then (optionally) re-read,
 * and keep the write's failure for the UI while rethrowing it for the caller.
 * `error` is the last write's failure, cleared when the next write starts.
 */
export function useWrite(after?: () => Promise<void>): {
	error: FonderieApiError | null;
	run: <R>(write: () => Promise<R>) => Promise<R>;
} {
	const [error, setError] = useState<FonderieApiError | null>(null);
	const run = useCallback(
		async <R,>(write: () => Promise<R>): Promise<R> => {
			setError(null);
			try {
				const out = await write();
				if (after) await after();
				return out;
			} catch (err) {
				const apiError = toApiError(err);
				setError(apiError);
				throw apiError;
			}
		},
		[after],
	);
	return { error, run };
}

// ── Paginated reads ─────────────────────────────────────────────────────────

/** One page as a paged read returns it. `next` is null on the last page. */
export interface IPage<Row, Cursor> {
	rows: Row[];
	next: Cursor | null;
	/** Total matching rows server-side, when the API reports one. */
	total?: number;
}

export interface IPagedQuery<Row> {
	/** The first page and every page loadMore appended, in order. */
	rows: Row[];
	/** Total matching rows, when the API reports one (else undefined). */
	total: number | undefined;
	hasMore: boolean;
	/** Nothing to show yet — never true while a refresh runs behind data. */
	isLoading: boolean;
	/** A loadMore is in flight. */
	isLoadingMore: boolean;
	error: FonderieApiError | null;
	/** Re-read the FIRST page (pages appended stay only if it is unchanged). */
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** Append the next page. No-op on the last page or while one loads; rethrows a failure. */
	loadMore: () => Promise<void>;
}

const NO_ROWS: never[] = [];

/**
 * A cursor- or offset-paginated list. The FIRST page is the shared, cached
 * read (useScopedQuery): shown at once on every visit, refreshed behind what
 * is shown. Pages appended by loadMore belong to this screen and to the exact
 * first page they extend: a refresh returning the same first page keeps the
 * same object — and so the appended pages; a different one (new rows, another
 * workspace, other filters) re-anchors the list instead of mixing the two.
 */
export function usePagedQuery<Row, Cursor>(
	source: object,
	path: string,
	readFirst: (bust: boolean) => Promise<IPage<Row, Cursor>>,
	readMore: (next: Cursor) => Promise<IPage<Row, Cursor>>,
	opts: IScopedQueryOptions<IPage<Row, Cursor>> & {
		/**
		 * Whether loadMore rethrows a failed page (default true — the caller can
		 * toast it). false = only report it on `error`, for hooks whose
		 * loadMore never threw (a list's onEndReached calls it fire-and-forget).
		 */
		rethrowLoadMore?: boolean;
	} = {},
): IPagedQuery<Row> {
	const { rethrowLoadMore, ...scoped } = opts;
	const rethrow = rethrowLoadMore !== false;
	const q = useScopedQuery(source, path, readFirst, scoped);
	const first = q.data;
	const [more, setMore] = useState<{ base: IPage<Row, Cursor>; rows: Row[]; next: Cursor | null; total?: number } | null>(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [pageError, setPageError] = useState<FonderieApiError | null>(null);
	const firstRef = useRef(first);
	firstRef.current = first;
	const busy = useRef(false);

	const extra = more && more.base === first ? more : null;
	const rows = useMemo(
		() => (first ? (extra ? [...first.rows, ...extra.rows] : first.rows) : (NO_ROWS as Row[])),
		[first, extra],
	);
	const next = extra ? extra.next : (first?.next ?? null);
	const total = extra?.total ?? first?.total;

	const loadMore = useCallback(async () => {
		const base = firstRef.current;
		if (!base || next === null || busy.current) return;
		busy.current = true;
		setIsLoadingMore(true);
		setPageError(null);
		try {
			const page = await readMore(next);
			// The list moved on (refresh with new rows, switch, new filters):
			// this page belongs to a list no longer shown.
			if (firstRef.current !== base) return;
			setMore((prev) => ({
				base,
				rows: [...(prev && prev.base === base ? prev.rows : []), ...page.rows],
				next: page.next,
				...(page.total !== undefined ? { total: page.total } : {}),
			}));
		} catch (err) {
			if (firstRef.current !== base) return;
			const apiError = toApiError(err);
			setPageError(apiError);
			if (rethrow) throw apiError;
		} finally {
			busy.current = false;
			setIsLoadingMore(false);
		}
	}, [next, readMore, rethrow]);

	return {
		rows,
		total,
		hasMore: next !== null,
		isLoading: q.isLoading,
		isLoadingMore,
		error: pageError ?? q.error,
		refresh: q.refresh,
		loadMore,
	};
}
