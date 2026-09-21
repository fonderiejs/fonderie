import type { AdminClient, IAdminLogEntry, IAdminLogQuery } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { computed, ref } from 'vue';

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminLog(client: AdminClient, query: Pick<IAdminLogQuery, 'limit'> = {}) {
	const entries = ref<IAdminLogEntry[]>([]);
	const next = ref<string | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const limit = query.limit;

	async function fetchPage(before?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.adminLog({
				...(limit ? { limit } : {}),
				...(before ? { before } : {}),
			});
			entries.value = before ? [...entries.value, ...result.entries] : result.entries;
			next.value = result.next;
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

	void refresh();

	return { entries, hasMore, isLoading, error, refresh, loadMore };
}
