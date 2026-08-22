import type { WebhooksClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import { ref } from 'vue';

export function useTestWebhookEndpoint(client?: WebhooksClient) {
	const webhooks = useFonderieSubClient(client, (c) => c.webhooks, 'useTestWebhookEndpoint');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function testEndpoint(endpointId: string) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await webhooks.testEndpoint(endpointId);
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

	return { testEndpoint, isLoading, error };
}
