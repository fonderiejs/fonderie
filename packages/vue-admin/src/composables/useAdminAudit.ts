import type { AuditAdminClient, IAdminAuditQuery, IAuditEventDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

// What happened, across every workspace unless one is named. Newest first.
// `query` is a ref so a filter form can drive it.
export function useAdminAudit(
	client: AuditAdminClient,
	query: Ref<Omit<IAdminAuditQuery, 'cursor'>>,
) {
	const events = ref<IAuditEventDTO[]>([]);
	const next = ref<string | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function fetchPage(cursor?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listAudit({ ...query.value, ...(cursor ? { cursor } : {}) });
			events.value = cursor ? [...events.value, ...result.events] : result.events;
			next.value = result.nextCursor;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	const refresh = () => fetchPage();
	async function loadMore() {
		if (next.value) await fetchPage(next.value);
	}
	const hasMore = computed(() => next.value !== null);

	watch(query, () => void refresh(), { immediate: true, deep: true });

	return { events, hasMore, isLoading, error, refresh, loadMore };
}
