import type { AuthAdminClient, ILoginEventDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminLoginHistory(
	client: AuthAdminClient,
	userId: Ref<string | null>,
	query: { limit?: number } = {},
) {
	const events = ref<ILoginEventDTO[]>([]);
	const next = ref<string | null>(null);
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const limit = query.limit;

	async function fetchPage(cursor?: string) {
		if (!userId.value) {
			events.value = [];
			next.value = null;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.userLoginHistory(userId.value, {
				...(limit ? { limit } : {}),
				...(cursor ? { cursor } : {}),
			});
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

	watch(userId, () => void refresh(), { immediate: true });

	return { events, hasMore, isLoading, error, refresh, loadMore };
}
