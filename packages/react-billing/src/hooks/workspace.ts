import type { FonderieApiError } from '@fonderie/client';
import { type IScopedQuery, useScopedQuery } from '@fonderie/react';

export { toApiError } from '@fonderie/react';

// Every billing read goes through @fonderie/react's useScopedQuery — the shared
// store, keyed by path and (for per-subscriber data) the selected workspace.
// See it for the rules; this alias keeps the billing hooks' call sites short.
export type IBillingQuery<T> = IScopedQuery<T>;

export function useBillingQuery<T>(
	billing: object,
	path: string,
	read: (bust: boolean) => Promise<T>,
	opts: { normal?: (err: FonderieApiError) => T | undefined; perWorkspace?: boolean } = {},
): IBillingQuery<T> {
	return useScopedQuery(billing, path, read, opts);
}
