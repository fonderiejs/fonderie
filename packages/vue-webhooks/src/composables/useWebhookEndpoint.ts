import type {
	IUpdateWebhookEndpointInput,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useWebhookEndpoint(client: WebhooksClient, endpointId: string) {
	const endpoint = ref<IWebhookEndpointDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		if (!endpointId) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.getEndpoint(endpointId);
			endpoint.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function updateEndpoint(input: IUpdateWebhookEndpointInput) {
		error.value = null;
		try {
			const { result } = await client.updateEndpoint(endpointId, input);
			endpoint.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { endpoint, isLoading, error, refresh, updateEndpoint };
}
