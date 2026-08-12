import type { IWebhookDeliveryDTO, WebhooksClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { ref } from 'vue';

export function useWebhookDeliveries(client: WebhooksClient, endpointId: string) {
	const deliveries = ref<IWebhookDeliveryDTO[]>([]);
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
			const { result } = await client.listDeliveries(endpointId);
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

	return { deliveries, isLoading, error, refresh };
}
