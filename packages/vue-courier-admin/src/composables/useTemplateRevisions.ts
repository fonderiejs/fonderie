import type { CourierAdminClient, ITemplateRevision } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useTemplateRevisions(
	client: CourierAdminClient,
	type: string,
	locale?: string | null,
) {
	const revisions = ref<ITemplateRevision[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listRevisions(type, locale);
			revisions.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function rollback(toVersion: number) {
		error.value = null;
		try {
			const { result } = await client.rollback(type, { toVersion }, locale);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { revisions, isLoading, error, refresh, rollback };
}
