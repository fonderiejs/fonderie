import { FonderieApiError, queryStoreFor } from '@fonderie/client';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref, shallowRef } from 'vue';

import { useWorkspaceId } from '../provider';
import { useClientQuery } from './useClientQuery';

// The read every Fonderie composable package makes — the Vue twin of
// @fonderie/react's useScopedQuery, with the same keys, so a React and a Vue
// screen over one client read one entry. One GET, keyed by its path and — for
// data that belongs to the selected workspace — that workspace.

export interface IScopedQueryOptions<T> {
	/** Map an error that is a normal state (404 = none, 501 = provider can't say) to the data to show. */
	normal?: (err: FonderieApiError) => T | undefined;
	/** false for reads that do not depend on the selected workspace. */
	perWorkspace?: boolean;
	/** false (or a getter returning false) → do not read yet, e.g. a required id is still empty. */
	enabled?: boolean | (() => boolean);
}

export interface IScopedQuery<T> {
	data: ComputedRef<T | undefined>;
	isLoading: ComputedRef<boolean>;
	error: ComputedRef<FonderieApiError | null>;
	/** Fetch now; `force` also bypasses the HTTP cache. */
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** Adopt an answer a write returned, so every screen shows it without a request. */
	adopt: (data: T) => void;
}

export function toApiError(err: unknown): FonderieApiError {
	return err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
}

/**
 * @param source the sub-client read through (its workspace scope keys the read)
 * @param path   the GET path, or a getter when it depends on reactive input
 * @param read   performs the request; `bust` is true on refresh({ force: true })
 */
export function useScopedQuery<T>(
	source: object,
	path: string | (() => string),
	read: (bust: boolean) => Promise<T>,
	opts: IScopedQueryOptions<T> = {},
): IScopedQuery<T> {
	// Only per-workspace reads follow the scope: a catalog never asks.
	const workspaceId = opts.perWorkspace === false ? null : useWorkspaceId(source);
	const isEnabled = () => (typeof opts.enabled === 'function' ? opts.enabled() : opts.enabled !== false);
	const keyOf = () => `GET ${typeof path === 'function' ? path() : path}::ws=${workspaceId?.value ?? ''}`;
	const q = useClientQuery<T>(source, () => (isEnabled() ? keyOf() : null), async ({ force }) => {
		try {
			return await read(force);
		} catch (err) {
			const apiError = toApiError(err);
			const asData = opts.normal?.(apiError);
			if (asData !== undefined) return asData;
			throw apiError;
		}
	});
	const store = queryStoreFor(source);
	return {
		data: q.data,
		isLoading: q.isLoading,
		error: computed(() => (q.error.value == null ? null : toApiError(q.error.value))),
		refresh: async (o) => {
			await q.refresh(o);
		},
		adopt: (data: T) => store.set(keyOf(), data),
	};
}

/**
 * The write side every composable repeats: run a write, then (optionally)
 * re-read, keeping the write's failure for the UI and rethrowing it.
 */
export function useWrite(after?: () => Promise<void>): {
	error: Ref<FonderieApiError | null>;
	run: <R>(write: () => Promise<R>) => Promise<R>;
} {
	const error = ref<FonderieApiError | null>(null);
	async function run<R>(write: () => Promise<R>): Promise<R> {
		error.value = null;
		try {
			const out = await write();
			if (after) await after();
			return out;
		} catch (err) {
			const apiError = toApiError(err);
			error.value = apiError;
			throw apiError;
		}
	}
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
	rows: ComputedRef<Row[]>;
	total: ComputedRef<number | undefined>;
	hasMore: ComputedRef<boolean>;
	isLoading: ComputedRef<boolean>;
	isLoadingMore: Ref<boolean>;
	error: ComputedRef<FonderieApiError | null>;
	/** Re-read the FIRST page (pages appended stay only if it is unchanged). */
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** Append the next page. No-op on the last page or while one loads; rethrows a failure. */
	loadMore: () => Promise<void>;
}

const NO_ROWS: never[] = [];

/**
 * A cursor- or offset-paginated list — the Vue twin of @fonderie/react's
 * usePagedQuery. The FIRST page is the shared, cached read; pages appended by
 * loadMore belong to the exact first page they extend (an unchanged refresh
 * keeps them, a changed first page re-anchors the list).
 */
export function usePagedQuery<Row, Cursor>(
	source: object,
	path: string | (() => string),
	readFirst: (bust: boolean) => Promise<IPage<Row, Cursor>>,
	readMore: (next: Cursor) => Promise<IPage<Row, Cursor>>,
	opts: IScopedQueryOptions<IPage<Row, Cursor>> & {
		/** Whether loadMore rethrows a failed page (default true); false = only report it on `error`. */
		rethrowLoadMore?: boolean;
	} = {},
): IPagedQuery<Row> {
	const { rethrowLoadMore, ...scoped } = opts;
	const q = useScopedQuery(source, path, readFirst, scoped);
	const more = shallowRef<{ base: IPage<Row, Cursor>; rows: Row[]; next: Cursor | null; total?: number } | null>(null);
	const isLoadingMore = ref(false);
	const pageError = ref<FonderieApiError | null>(null);
	const extra = computed(() => (more.value && more.value.base === q.data.value ? more.value : null));
	const next = computed(() => (extra.value ? extra.value.next : (q.data.value?.next ?? null)));

	async function loadMore() {
		const base = q.data.value;
		const cursor = next.value;
		if (!base || cursor === null || isLoadingMore.value) return;
		isLoadingMore.value = true;
		pageError.value = null;
		try {
			const page = await readMore(cursor);
			if (q.data.value !== base) return;
			const prev = more.value && more.value.base === base ? more.value.rows : [];
			more.value = {
				base,
				rows: [...prev, ...page.rows],
				next: page.next,
				...(page.total !== undefined ? { total: page.total } : {}),
			};
		} catch (err) {
			if (q.data.value !== base) return;
			const apiError = toApiError(err);
			pageError.value = apiError;
			if (rethrowLoadMore !== false) throw apiError;
		} finally {
			isLoadingMore.value = false;
		}
	}

	return {
		rows: computed(() => {
			const first = q.data.value;
			if (!first) return NO_ROWS as Row[];
			return extra.value ? [...first.rows, ...extra.value.rows] : first.rows;
		}),
		total: computed(() => extra.value?.total ?? q.data.value?.total),
		hasMore: computed(() => next.value !== null),
		isLoading: q.isLoading,
		isLoadingMore,
		error: computed(() => pageError.value ?? q.error.value),
		refresh: q.refresh,
		loadMore,
	};
}
