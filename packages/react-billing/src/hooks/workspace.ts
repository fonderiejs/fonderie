import { FonderieApiError, queryStoreFor } from '@fonderie/client';
import { useClientQuery, useWorkspaceId } from '@fonderie/react';
import { useCallback } from 'react';

// Every billing read goes through the client's shared store (useClientQuery):
// a screen shown again opens on its data, a refresh happens behind the data,
// an unchanged answer changes nothing on screen.
//
// Billing data belongs to a subscriber — with workspace billing, the selected
// workspace — so the key carries the workspace: a switch reads the other
// workspace's entry (instantly, when it was seen before) and the previous
// workspace's subscription / card / invoices are never shown under the new one.

export interface IBillingQuery<T> {
	data: T | undefined;
	isLoading: boolean;
	error: FonderieApiError | null;
	/** Fetch now; `force` is passed on as the HTTP cache's bust. */
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	/** Adopt an answer a write returned, so every screen shows it without a request. */
	adopt: (data: T) => void;
	/** The store key — identifies "this subscriber's this read" (changes on a switch). */
	key: string;
}

export function toApiError(err: unknown): FonderieApiError {
	return err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
}

/**
 * @param billing  the billing sub-client
 * @param path     the GET path read — the key starts with it, so a write under
 *                 the same resource (any POST to /billing/…) marks it stale
 * @param read     performs the request (`bust` on an explicit refresh)
 * @param opts.normal  maps an error that is a normal state (404 = no
 *                 subscription, 501 = provider can't say) to the data to show
 * @param opts.perWorkspace  false for reads that are not per subscriber (plans)
 */
export function useBillingQuery<T>(
	billing: object,
	path: string,
	read: (bust: boolean) => Promise<T>,
	opts: { normal?: (err: FonderieApiError) => T | undefined; perWorkspace?: boolean } = {},
): IBillingQuery<T> {
	const workspaceId = useWorkspaceId(billing);
	const key = `GET ${path}::ws=${opts.perWorkspace === false ? '' : (workspaceId ?? '')}`;
	const normal = opts.normal;
	const q = useClientQuery<T>(billing, key, async ({ force }) => {
		try {
			return await read(force);
		} catch (err) {
			const apiError = toApiError(err);
			const asData = normal?.(apiError);
			if (asData !== undefined) return asData;
			throw apiError;
		}
	});
	const store = queryStoreFor(billing);
	const refresh = useCallback(async () => {
		await q.refresh();
	}, [q.refresh]);
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
