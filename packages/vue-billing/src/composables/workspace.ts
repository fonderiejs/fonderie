import { FonderieApiError, queryStoreFor } from '@fonderie/client';
import { useClientQuery, useWorkspaceId } from '@fonderie/vue';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';

// Every billing read goes through the client's shared store (useClientQuery):
// a screen shown again opens on its data, a refresh happens behind the data,
// an unchanged answer changes nothing on screen. The Vue twin of
// @fonderie/react-billing's helper — same keys, so both read one entry.
//
// The key carries the workspace: a switch reads the other workspace's entry
// (instantly, when seen before) and never shows the previous one's data.

export interface IBillingQuery<T> {
	data: ComputedRef<T | undefined>;
	isLoading: ComputedRef<boolean>;
	error: ComputedRef<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** Adopt an answer a write returned, so every screen shows it without a request. */
	adopt: (data: T) => void;
}

export function toApiError(err: unknown): FonderieApiError {
	return err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
}

export function useBillingQuery<T>(
	billing: object,
	path: string | (() => string),
	read: (bust: boolean) => Promise<T>,
	opts: { normal?: (err: FonderieApiError) => T | undefined; perWorkspace?: boolean } = {},
): IBillingQuery<T> {
	// Only per-subscriber reads follow the workspace; the catalog never asks.
	const workspaceId = opts.perWorkspace === false ? null : useWorkspaceId(billing);
	const keyOf = () => `GET ${typeof path === 'function' ? path() : path}::ws=${workspaceId?.value ?? ''}`;
	const q = useClientQuery<T>(billing, keyOf, async ({ force }) => {
		try {
			return await read(force);
		} catch (err) {
			const apiError = toApiError(err);
			const asData = opts.normal?.(apiError);
			if (asData !== undefined) return asData;
			throw apiError;
		}
	});
	const store = queryStoreFor(billing);
	return {
		data: q.data,
		isLoading: q.isLoading,
		error: computed(() => (q.error.value == null ? null : toApiError(q.error.value))),
		refresh: async () => {
			await q.refresh();
		},
		adopt: (data: T) => store.set(keyOf(), data),
	};
}
