import type { CourierAdminClient, ISetTemplateInput, ITemplateEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useTemplates(client: CourierAdminClient) {
	const templates = ref<ITemplateEntry[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listTemplates();
			templates.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	async function saveTemplate(type: string, input: ISetTemplateInput, locale?: string) {
		error.value = null;
		try {
			const { result } = await client.setTemplate(type, input, locale);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeTemplate(type: string, locale?: string) {
		error.value = null;
		try {
			await client.deleteTemplate(type, locale);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { templates, isLoading, error, refresh, saveTemplate, removeTemplate };
}
