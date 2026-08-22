import type { IAuditEventDTO, IListAuditEventsInput } from '@fonderie/client';
import { AuditClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

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
	const events = ref<IAuditEventDTO[]>([]);
	const cursor = ref<string | null>(null);
	const hasMore = ref(false);
	const isLoading = ref(true);
	const isLoadingMore = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await audit.listEvents(resolveFilters(), { bust: opts?.force });
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
			const { result } = await audit.listEvents({ ...resolveFilters(), cursor: cursor.value });
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

	onMounted(() => void refresh());
	// Keyed on content, not identity — a getter returning a fresh object
	// literal must not refetch unless the filter values actually changed,
	// mirroring the React hook's JSON.stringify memo.
	watch(
		() => JSON.stringify(resolveFilters()),
		() => void refresh(),
	);

	return { events, isLoading, isLoadingMore, error, hasMore, refresh, loadMore };
}
