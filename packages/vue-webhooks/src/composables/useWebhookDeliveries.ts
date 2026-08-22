import type { IWebhookDeliveryDTO, ITestWebhookResult } from '@fonderie/client';
import { FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

export interface IUseWebhookDeliveriesReturn {
	deliveries: Ref<IWebhookDeliveryDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	testEndpoint: () => Promise<ITestWebhookResult>;
}

export function useWebhookDeliveries(
	endpointId: MaybeRefOrGetter<string>,
): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	client: WebhooksClient | undefined,
	endpointId: MaybeRefOrGetter<string>,
): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	clientOrEndpointId: WebhooksClient | MaybeRefOrGetter<string> | undefined,
	maybeEndpointId?: MaybeRefOrGetter<string>,
): IUseWebhookDeliveriesReturn {
	const firstIsClient =
		clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient
		? (maybeEndpointId as MaybeRefOrGetter<string>)
		: clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookDeliveries');
	const deliveries = ref<IWebhookDeliveryDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		if (!toValue(endpointId)) {
			isLoading.value = false;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await webhooks.listDeliveries(toValue(endpointId), { bust: opts?.force });
			deliveries.value = result.deliveries;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(endpointId),
		() => void refresh(),
	);

	async function testEndpoint() {
		error.value = null;
		try {
			const { result } = await webhooks.testEndpoint(toValue(endpointId));
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
