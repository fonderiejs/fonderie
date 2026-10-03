import type { IWebhookDeliveryDTO, ITestWebhookResult } from '@fonderie/client';
import { type FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

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
	// The key follows the endpoint; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		webhooks,
		() => `/webhooks/${encodeURIComponent(toValue(endpointId))}/deliveries`,
		async (bust) => (await webhooks.listDeliveries(toValue(endpointId), { bust })).result.deliveries,
		{ enabled: () => !!toValue(endpointId) },
	);
	// A test send adds a delivery: re-read the log after it.
	const w = useWrite(() => q.refresh());
	return {
		deliveries: computed(() => q.data.value ?? []),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		testEndpoint: () => w.run(async () => (await webhooks.testEndpoint(toValue(endpointId))).result),
	};
}
