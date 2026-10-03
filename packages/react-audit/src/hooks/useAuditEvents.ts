import type { FonderieApiError, IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { AuditClient, queryParams } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery } from '@fonderie/react';
import { useMemo } from 'react';

export interface IUseAuditEventsReturn {
	events: IAuditEventDTO[];
	/** Nothing to show yet — never true while a refresh runs behind events shown. */
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
	// Keyed by content, not identity: callers pass a fresh {} on every render.
	const key = queryParams({ ...rawFilters, cursor: undefined });
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on content, not identity
	const filters = useMemo(() => rawFilters, [queryParams(rawFilters)]);
	const q = usePagedQuery<IAuditEventDTO, string>(
		audit,
		`/audit${key}`,
		// The first page — a refresh always starts from it.
		async (bust) => {
			const { result } = await audit.listEvents(filters, { bust });
			return { rows: result.events, next: result.nextCursor };
		},
		async (cursor) => {
			const { result } = await audit.listEvents({ ...filters, cursor });
			return { rows: result.events, next: result.nextCursor };
		},
		// loadMore here never threw: a list's onEndReached calls it fire-and-forget.
		// A failed page is reported on `error` only.
		{ rethrowLoadMore: false },
	);
	return {
		events: q.rows,
		isLoading: q.isLoading,
		isLoadingMore: q.isLoadingMore,
		error: q.error,
		hasMore: q.hasMore,
		refresh: q.refresh,
		loadMore: q.loadMore,
	};
}
