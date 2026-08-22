import type { IWebhookDeliveryDTO, ITestWebhookResult } from '@fonderie/client';
import { FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseWebhookDeliveriesReturn {
	deliveries: Ref<IWebhookDeliveryDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	testEndpoint: () => Promise<ITestWebhookResult>;
}

export function useWebhookDeliveries(endpointId: string): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	client: WebhooksClient | undefined,
	endpointId: string,
): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	clientOrEndpointId: WebhooksClient | string | undefined,
	maybeEndpointId?: string,
): IUseWebhookDeliveriesReturn {
	const firstIsClient =
		clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient ? (maybeEndpointId as string) : clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookDeliveries');
	const deliveries = ref<IWebhookDeliveryDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		if (!endpointId) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await webhooks.listDeliveries(endpointId, { bust: opts?.force });
			deliveries.value = result.deliveries;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	void refresh();

	async function testEndpoint() {
		error.value = null;
		try {
			const { result } = await webhooks.testEndpoint(endpointId);
			await refresh();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { deliveries, isLoading, error, refresh, testEndpoint };
}
