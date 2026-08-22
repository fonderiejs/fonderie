import type { CourierAdminClient, ISetTemplateInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

/** @deprecated Use useTemplates(client).saveTemplate — the list composable self-refreshes after the write. */
export function useSaveTemplate(client: CourierAdminClient) {
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function saveTemplate(type: string, input: ISetTemplateInput, locale?: string | null) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.setTemplate(type, input, locale);
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { saveTemplate, isLoading, error };
}
