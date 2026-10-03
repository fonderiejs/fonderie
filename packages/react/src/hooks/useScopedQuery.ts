import { FonderieApiError, queryStoreFor } from '@fonderie/client';
import { useCallback, useState } from 'react';

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
