import type { CourierAdminClient, IBuiltInTemplate } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// Fonderie's own copy of an email in a language — to open a language nobody has
// saved yet, or to compare a saved version with what ships. `builtIn` stays null
// when none ships in that language (a 404 is an answer here, not an error).
export function useBuiltInTemplate(
	client: CourierAdminClient,
	type: string,
	locale?: string | null,
) {
	const builtIn = ref<IBuiltInTemplate | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.getBuiltInTemplate(type, locale);
			builtIn.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			if (apiError.status === 404) builtIn.value = null;
			else error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	return { builtIn, isLoading, error, refresh };
}
