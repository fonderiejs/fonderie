import type { IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { AuditClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface IUseAuditEventsReturn {
	events: IAuditEventDTO[];
	isLoading: boolean;
	isLoadingMore: boolean;
	error: FonderieApiError | null;
	hasMore: boolean;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
}

export function useAuditEvents(rawFilters?: IListAuditEventsInput): IUseAuditEventsReturn;
export function useAuditEvents(
	client: AuditClient | undefined,
	rawFilters?: IListAuditEventsInput,
): IUseAuditEventsReturn;
export function useAuditEvents(
	clientOrFilters?: AuditClient | IListAuditEventsInput,
	maybeFilters?: IListAuditEventsInput,
): IUseAuditEventsReturn {
	const firstIsClient = clientOrFilters === undefined || clientOrFilters instanceof AuditClient;
	const explicit = firstIsClient ? (clientOrFilters as AuditClient | undefined) : undefined;
	const rawFilters = (firstIsClient ? maybeFilters : clientOrFilters) ?? {};
	const audit = useFonderieSubClient(explicit, (c) => c.audit, 'useAuditEvents');
	// Memoized by value (not reference) — `rawFilters` defaults to a fresh {}
	// on every render when the caller omits it, which would otherwise refetch
	// on every render regardless of the dependency list below.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on content, not identity
	const filters = useMemo(() => rawFilters, [JSON.stringify(rawFilters)]);

	const [events, setEvents] = useState<IAuditEventDTO[]>([]);
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
				// Refresh resets the cursor to the first page — bust only that fetch.
				const { result } = await audit.listEvents(filters, { bust: opts?.force });
				setEvents(result.events);
				setCursor(result.nextCursor);
				setHasMore(result.nextCursor !== null);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[audit, filters],
	);

	const loadMore = useCallback(async () => {
		if (!cursor || isLoadingMore) return;
		setIsLoadingMore(true);
		setError(null);
		try {
			const { result } = await audit.listEvents({ ...filters, cursor });
			setEvents((prev) => [...prev, ...result.events]);
			setCursor(result.nextCursor);
			setHasMore(result.nextCursor !== null);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoadingMore(false);
		}
	}, [audit, filters, cursor, isLoadingMore]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore };
}
