import type { AuthAdminClient, IAdminUserDTO, IAdminUsersQuery } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { computed, ref } from 'vue';

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminUsers(
	client: AuthAdminClient,
	query: Omit<IAdminUsersQuery, 'cursor'> = {},
) {
	const users = ref<IAdminUserDTO[]>([]);
	const next = ref<string | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const limit = query.limit;

	async function fetchPage(cursor?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listUsers({
				...(limit ? { limit } : {}),
				...(cursor ? { cursor } : {}),
			});
			users.value = cursor ? [...users.value, ...result.users] : result.users;
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

	void refresh();

	return { users, hasMore, isLoading, error, refresh, loadMore };
}
