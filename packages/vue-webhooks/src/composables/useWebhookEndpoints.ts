import type {
	ICreateWebhookEndpointInput,
	ITestWebhookResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseWebhookEndpointsReturn {
	endpoints: Ref<IWebhookEndpointDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createEndpoint: (input: ICreateWebhookEndpointInput) => Promise<IWebhookEndpointCreatedDTO>;
	removeEndpoint: (endpointId: string) => Promise<void>;
	testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>;
}

export function useWebhookEndpoints(client?: WebhooksClient): IUseWebhookEndpointsReturn {
	const webhooks = useFonderieSubClient(client, (c) => c.webhooks, 'useWebhookEndpoints');
	const endpoints = ref<IWebhookEndpointDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await webhooks.listEndpoints({ bust: opts?.force });
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
			const { result } = await webhooks.createEndpoint(input);
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
			await webhooks.deleteEndpoint(endpointId);
			await refresh();
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	// Test-sends to one endpoint from the list — a test delivery doesn't change
	// the endpoints list, so unlike the other writes there's nothing to refresh.
	// For a per-endpoint view, useWebhookDeliveries(endpointId).testEndpoint also
	// re-reads that endpoint's delivery log after the send.
	async function testEndpoint(endpointId: string) {
		error.value = null;
		try {
			const { result } = await webhooks.testEndpoint(endpointId);
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());

	return { endpoints, isLoading, error, refresh, createEndpoint, removeEndpoint, testEndpoint };
}
