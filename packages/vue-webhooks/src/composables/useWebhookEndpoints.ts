import type {
	ICreateWebhookEndpointInput,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useWebhookEndpoints(client: WebhooksClient) {
	const endpoints = ref<IWebhookEndpointDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh() {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await client.listEndpoints();
			endpoints.value = result.endpoints;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function createEndpoint(input: ICreateWebhookEndpointInput) {
		error.value = null;
		try {
			const { result } = await client.createEndpoint(input);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	async function removeEndpoint(endpointId: string) {
		error.value = null;
		try {
			await client.deleteEndpoint(endpointId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	void refresh();

	return { endpoints, isLoading, error, refresh, createEndpoint, removeEndpoint };
}
