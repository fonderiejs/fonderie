import { FonderieApiError, queryStoreFor } from '@fonderie/client';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref } from 'vue';

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
	const keyOf = () => `GET ${typeof path === 'function' ? path() : path}::ws=${workspaceId?.value ?? ''}`;
	const q = useClientQuery<T>(source, keyOf, async ({ force }) => {
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
