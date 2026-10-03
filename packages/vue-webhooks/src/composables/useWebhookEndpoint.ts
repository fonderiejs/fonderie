import type { IUpdateWebhookEndpointInput, IWebhookEndpointDTO } from '@fonderie/client';
import { type FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

export interface IUseWebhookEndpointReturn {
	endpoint: Ref<IWebhookEndpointDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	updateEndpoint: (input: IUpdateWebhookEndpointInput) => Promise<void>;
}

export function useWebhookEndpoint(endpointId: MaybeRefOrGetter<string>): IUseWebhookEndpointReturn;
export function useWebhookEndpoint(
	client: WebhooksClient | undefined,
	endpointId: MaybeRefOrGetter<string>,
): IUseWebhookEndpointReturn;
export function useWebhookEndpoint(
	clientOrEndpointId: WebhooksClient | MaybeRefOrGetter<string> | undefined,
	maybeEndpointId?: MaybeRefOrGetter<string>,
): IUseWebhookEndpointReturn {
	const firstIsClient =
		clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient
		? (maybeEndpointId as MaybeRefOrGetter<string>)
		: clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookEndpoint');
	// The key follows the endpoint; an empty id reads nothing (not loading).
	const q = useScopedQuery(
		webhooks,
		() => `/webhooks/${encodeURIComponent(toValue(endpointId))}`,
		async (bust) => (await webhooks.getEndpoint(toValue(endpointId), { bust })).result,
		{ enabled: () => !!toValue(endpointId) },
	);
	const w = useWrite();
	return {
		endpoint: computed(() => q.data.value ?? null),
		isLoading: q.isLoading,
		error: computed(() => w.error.value ?? q.error.value),
		refresh: q.refresh,
		// The update returns the endpoint: every screen showing it adopts it.
		updateEndpoint: (input) =>
			w.run(async () => {
				q.adopt((await webhooks.updateEndpoint(toValue(endpointId), input)).result);
			}),
	};
}
