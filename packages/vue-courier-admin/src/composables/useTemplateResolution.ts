import type { CourierAdminClient, ITemplateResolution } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

// Who receives what — asked of the server, which decides with the same function
// a real send runs.
export function useTemplateResolution(client: CourierAdminClient) {
	const resolution = ref<ITemplateResolution | null>(null);
	const isResolving = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function resolve(
		type: string,
		locale?: string | null,
	): Promise<ITemplateResolution | null> {
		isResolving.value = true;
		error.value = null;
		try {
			const { result } = await client.resolveTemplate(type, locale);
			resolution.value = result;
			return result;
		} catch (err) {
			error.value =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			resolution.value = null;
			return null;
		} finally {
			isResolving.value = false;
		}
	}

	return { resolution, isResolving, error, resolve };
}
