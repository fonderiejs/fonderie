import type { FonderieApiError, ITestWebhookResult, IWebhookDeliveryDTO } from '@fonderie/client';
import { WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseWebhookDeliveriesReturn {
	deliveries: IWebhookDeliveryDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Sends a test event to this endpoint, then re-reads its delivery log so
	// the test delivery shows up.
	testEndpoint: () => Promise<ITestWebhookResult>;
}

const NONE: IWebhookDeliveryDTO[] = [];

export function useWebhookDeliveries(endpointId: string): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	client: WebhooksClient | undefined,
	endpointId: string,
): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	clientOrEndpointId: WebhooksClient | string | undefined,
	maybeEndpointId?: string,
): IUseWebhookDeliveriesReturn {
	const firstIsClient = clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient ? (maybeEndpointId as string) : clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookDeliveries');
	const q = useScopedQuery(
		webhooks,
		`/webhooks/${encodeURIComponent(endpointId ?? '')}/deliveries`,
		async (bust) => (await webhooks.listDeliveries(endpointId, { bust })).result.deliveries,
		{ enabled: !!endpointId },
	);
	const w = useWrite(q.refresh);
	const testEndpoint = useCallback(
		() => w.run(async () => (await webhooks.testEndpoint(endpointId)).result),
		[webhooks, endpointId, w.run],
	);
	return { deliveries: q.data ?? NONE, isLoading: q.isLoading, error: w.error ?? q.error, refresh: q.refresh, testEndpoint };
}
