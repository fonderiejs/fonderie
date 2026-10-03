import type { IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { AuditClient, type FonderieApiError, queryParams } from '@fonderie/client';
import { useFonderieSubClient, usePagedQuery } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { toValue } from 'vue';

export interface IUseAuditEventsReturn {
	events: Ref<IAuditEventDTO[]>;
	isLoading: Ref<boolean>;
	isLoadingMore: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	hasMore: Ref<boolean>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
}

export function useAuditEvents(
	filters?: MaybeRefOrGetter<IListAuditEventsInput | undefined>,
): IUseAuditEventsReturn;
export function useAuditEvents(
	client: AuditClient | undefined,
	filters?: MaybeRefOrGetter<IListAuditEventsInput | undefined>,
): IUseAuditEventsReturn;
export function useAuditEvents(
	clientOrFilters?: AuditClient | MaybeRefOrGetter<IListAuditEventsInput | undefined>,
	maybeFilters?: MaybeRefOrGetter<IListAuditEventsInput | undefined>,
): IUseAuditEventsReturn {
	const firstIsClient = clientOrFilters === undefined || clientOrFilters instanceof AuditClient;
	const explicit = firstIsClient ? (clientOrFilters as AuditClient | undefined) : undefined;
	const rawFilters = firstIsClient
		? maybeFilters
		: (clientOrFilters as MaybeRefOrGetter<IListAuditEventsInput | undefined>);
	const resolveFilters = (): IListAuditEventsInput => toValue(rawFilters) ?? {};
	const audit = useFonderieSubClient(explicit, (c) => c.audit, 'useAuditEvents');
	// The first page is the shared, cached read, keyed by the filters (the
	// cursor aside — it is the page cursor); loadMore appends by cursor.
	const listFilters = (): IListAuditEventsInput => {
		const { cursor: _cursor, ...rest } = resolveFilters();
		return rest;
	};
	const q = usePagedQuery<IAuditEventDTO, string>(
		audit,
		() => `/audit${queryParams(listFilters())}`,
		async (bust) => {
			const { result } = await audit.listEvents(resolveFilters(), { bust });
			return { rows: result.events, next: result.nextCursor };
		},
		async (cursor) => {
			const { result } = await audit.listEvents({ ...resolveFilters(), cursor });
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
