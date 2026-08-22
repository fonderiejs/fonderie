import type { ITestWebhookResult, WebhooksClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

/** @deprecated Use useWebhookDeliveries(endpointId).testEndpoint — the list hook self-refreshes after the write. */
export interface IUseTestWebhookEndpointReturn {
	testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

/** @deprecated Use useWebhookDeliveries(endpointId).testEndpoint — the list hook self-refreshes after the write. */
export function useTestWebhookEndpoint(client?: WebhooksClient): IUseTestWebhookEndpointReturn {
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
