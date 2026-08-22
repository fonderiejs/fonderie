import type { IUpdateWebhookEndpointInput, IWebhookEndpointDTO } from '@fonderie/client';
import { FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { onMounted, ref, toValue, watch } from 'vue';

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
	const endpoint = ref<IWebhookEndpointDTO | null>(null);
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
			const { result } = await webhooks.getEndpoint(toValue(endpointId), { bust: opts?.force });
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
			const { result } = await webhooks.updateEndpoint(toValue(endpointId), input);
			endpoint.value = result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());
	watch(
		() => toValue(endpointId),
		() => void refresh(),
	);

	return { endpoint, isLoading, error, refresh, updateEndpoint };
}
