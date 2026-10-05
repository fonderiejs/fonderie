import type { AuthAdminClient, IAdminErasureDTO, IAdminErasuresQuery } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { computed, ref } from 'vue';

const asApiError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

// Erasure receipts, newest first; with an email or phone, that person's.
export function useAdminErasures(
	client: AuthAdminClient,
	query: Omit<IAdminErasuresQuery, 'cursor'> = {},
) {
	const erasures = ref<IAdminErasureDTO[]>([]);
	const next = ref<string | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);
	const { limit, email, phone } = query;

	async function fetchPage(cursor?: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listErasures({
				...(limit ? { limit } : {}),
				...(cursor ? { cursor } : {}),
				...(email ? { email } : {}),
				...(phone ? { phone } : {}),
			});
			erasures.value = cursor ? [...erasures.value, ...result.erasures] : result.erasures;
			next.value = result.nextCursor;
		} catch (err) {
			error.value = asApiError(err);
		} finally {
			isLoading.value = false;
		}
	}

	const refresh = () => fetchPage();
	async function loadMore() {
		if (next.value) await fetchPage(next.value);
	}
	// Every receipt, for the auditor's evidence folder.
	async function exportAll() {
		error.value = null;
		try {
			return (await client.exportErasures()).result;
		} catch (err) {
			error.value = asApiError(err);
			return null;
		}
	}
	const hasMore = computed(() => next.value !== null);

	void refresh();

	return { erasures, hasMore, isLoading, error, refresh, loadMore, exportAll };
}
