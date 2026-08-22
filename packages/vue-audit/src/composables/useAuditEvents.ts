import type { IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { AuditClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseAuditEventsReturn {
	events: Ref<IAuditEventDTO[]>;
	isLoading: Ref<boolean>;
	isLoadingMore: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	hasMore: Ref<boolean>;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
}

export function useAuditEvents(filters?: IListAuditEventsInput): IUseAuditEventsReturn;
export function useAuditEvents(
	client: AuditClient | undefined,
	filters?: IListAuditEventsInput,
): IUseAuditEventsReturn;
export function useAuditEvents(
	clientOrFilters?: AuditClient | IListAuditEventsInput,
	maybeFilters?: IListAuditEventsInput,
): IUseAuditEventsReturn {
	const firstIsClient = clientOrFilters === undefined || clientOrFilters instanceof AuditClient;
	const explicit = firstIsClient ? (clientOrFilters as AuditClient | undefined) : undefined;
	const filters = (firstIsClient ? maybeFilters : (clientOrFilters as IListAuditEventsInput)) ?? {};
	const audit = useFonderieSubClient(explicit, (c) => c.audit, 'useAuditEvents');
	const events = ref<IAuditEventDTO[]>([]);
	const cursor = ref<string | null>(null);
	const hasMore = ref(false);
	const isLoading = ref(true);
	const isLoadingMore = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await audit.listEvents(filters);
			events.value = result.events;
			cursor.value = result.nextCursor;
			hasMore.value = result.nextCursor !== null;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function loadMore() {
		if (!cursor.value || isLoadingMore.value) return;
		isLoadingMore.value = true;
		error.value = null;
		try {
			const { result } = await audit.listEvents({ ...filters, cursor: cursor.value });
			events.value = [...events.value, ...result.events];
			cursor.value = result.nextCursor;
			hasMore.value = result.nextCursor !== null;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoadingMore.value = false;
		}
	}

	// `filters` is read once here, same as every other *-admin/*-workspaces
	// composable's `key`/`environment` params in this SDK — call refresh()
	// yourself with new filters to requery; setup() doesn't re-run on
	// prop changes, so a reactive filters object wouldn't be observed anyway.
	void refresh();

	return { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore };
}
