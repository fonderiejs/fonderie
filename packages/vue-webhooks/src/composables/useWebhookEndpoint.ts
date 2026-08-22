import type { IUpdateWebhookEndpointInput, IWebhookEndpointDTO } from '@fonderie/client';
import { FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseWebhookEndpointReturn {
	endpoint: Ref<IWebhookEndpointDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: () => Promise<void>;
	updateEndpoint: (input: IUpdateWebhookEndpointInput) => Promise<void>;
}

export function useWebhookEndpoint(endpointId: string): IUseWebhookEndpointReturn;
export function useWebhookEndpoint(
	client: WebhooksClient | undefined,
	endpointId: string,
): IUseWebhookEndpointReturn;
export function useWebhookEndpoint(
	clientOrEndpointId: WebhooksClient | string | undefined,
	maybeEndpointId?: string,
): IUseWebhookEndpointReturn {
	const firstIsClient =
		clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient ? (maybeEndpointId as string) : clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookEndpoint');
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
			const { result } = await webhooks.getEndpoint(endpointId);
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
			const { result } = await webhooks.updateEndpoint(endpointId, input);
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
