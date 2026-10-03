import type { FonderieApiError, IUpdateWebhookEndpointInput, IWebhookEndpointDTO } from '@fonderie/client';
import { WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseWebhookEndpointReturn {
	endpoint: IWebhookEndpointDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
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
	const firstIsClient = clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient ? (maybeEndpointId as string) : clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookEndpoint');
	const q = useScopedQuery(
		webhooks,
		`/webhooks/${encodeURIComponent(endpointId ?? '')}`,
		async (bust) => (await webhooks.getEndpoint(endpointId, { bust })).result,
		{ enabled: !!endpointId },
	);
	const w = useWrite();
	const updateEndpoint = useCallback(
		(input: IUpdateWebhookEndpointInput) =>
			w.run(async () => {
				// The update returns the endpoint: every screen adopts it.
				q.adopt((await webhooks.updateEndpoint(endpointId, input)).result);
			}),
		[webhooks, endpointId, w.run, q.adopt],
	);
	return { endpoint: q.data ?? null, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, updateEndpoint };
}
