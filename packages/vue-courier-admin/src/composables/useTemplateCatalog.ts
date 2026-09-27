import type { CourierAdminClient, ITemplateCatalog } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// Every email — saved or built-in only — with its languages and the app's
// locales, for a template list that shows what actually exists.
export function useTemplateCatalog(client: CourierAdminClient) {
	const catalog = ref<ITemplateCatalog | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.getTemplateCatalog();
			catalog.value = result;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { catalog, isLoading, error, refresh };
}
