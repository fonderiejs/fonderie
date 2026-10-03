import type {
	ICreateWebhookEndpointInput,
	ITestWebhookResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import type { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

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
	const q = useScopedQuery(webhooks, '/webhooks', async (bust) => (await webhooks.listEndpoints({ bust })).result.endpoints);
	const w = useWrite(() => q.refresh());
	// Test-sends don't change the endpoints list: nothing to re-read after one.
	// For a per-endpoint view, useWebhookDeliveries(endpointId).testEndpoint
	// re-reads that endpoint's delivery log after the send.
	const test = useWrite();
	return {
		endpoints: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => test.error.value ?? w.error.value ?? q.error.value),
		refresh: q.refresh,
		createEndpoint: (input) => w.run(async () => (await webhooks.createEndpoint(input)).result),
		removeEndpoint: (endpointId) =>
			w.run(async () => {
				await webhooks.deleteEndpoint(endpointId);
			}),
		testEndpoint: (endpointId) => test.run(async () => (await webhooks.testEndpoint(endpointId)).result),
	};
}
