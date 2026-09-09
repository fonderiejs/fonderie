import type { AuthClient, ILoginEventDTO, IGetLoginHistoryInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface IUseLoginHistoryReturn {
	events: ILoginEventDTO[];
	isLoading: boolean;
	isLoadingMore: boolean;
	error: FonderieApiError | null;
	hasMore: boolean;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
}

// The caller's own login attempts, newest first, keyset-paginated. Deliberately
// the same shape as react-audit's useAuditEvents so a login-history list and an
// audit-log list are built against an identical contract.
export function useLoginHistory(rawFilters?: IGetLoginHistoryInput): IUseLoginHistoryReturn;
export function useLoginHistory(
	client: AuthClient | undefined,
	rawFilters?: IGetLoginHistoryInput,
): IUseLoginHistoryReturn;
export function useLoginHistory(
	clientOrFilters?: AuthClient | IGetLoginHistoryInput,
	maybeFilters?: IGetLoginHistoryInput,
): IUseLoginHistoryReturn {
	// The AuthClient isn't reliably an instanceof across bundle boundaries, so
	// detect the client arg structurally (it has getLoginHistory) rather than
	// by prototype.
	const firstIsClient =
		clientOrFilters === undefined ||
		typeof (clientOrFilters as AuthClient).getLoginHistory === 'function';
	const explicit = firstIsClient ? (clientOrFilters as AuthClient | undefined) : undefined;
	const rawFilters = (firstIsClient ? maybeFilters : (clientOrFilters as IGetLoginHistoryInput)) ?? {};
	const auth = useFonderieSubClient(explicit, (c) => c.auth, 'useLoginHistory');
	// Keyed by content, not identity — an omitted filters arg is a fresh {} each
	// render and would otherwise refetch every render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on content
	const filters = useMemo(() => rawFilters, [JSON.stringify(rawFilters)]);

	const [events, setEvents] = useState<ILoginEventDTO[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await auth.getLoginHistory(filters, { bust: opts?.force });
				setEvents(result.events);
				setCursor(result.nextCursor);
				setHasMore(result.nextCursor !== null);
			} catch (err) {
				setError(
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
				);
			} finally {
				setIsLoading(false);
			}
		},
		[auth, filters],
	);

	const loadMore = useCallback(async () => {
		if (!cursor || isLoadingMore) return;
		setIsLoadingMore(true);
		setError(null);
		try {
			const { result } = await auth.getLoginHistory({ ...filters, cursor });
			setEvents((prev) => [...prev, ...result.events]);
			setCursor(result.nextCursor);
			setHasMore(result.nextCursor !== null);
		} catch (err) {
			setError(
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
			);
		} finally {
			setIsLoadingMore(false);
		}
	}, [auth, filters, cursor, isLoadingMore]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore };
}
