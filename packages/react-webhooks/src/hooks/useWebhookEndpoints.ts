import type {
	FonderieApiError,
	ICreateWebhookEndpointInput,
	ITestWebhookResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { useFonderieSubClient, useScopedQuery, useWrite } from '@fonderie/react';
import { useCallback } from 'react';

export interface IUseWebhookEndpointsReturn {
	endpoints: IWebhookEndpointDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createEndpoint: (input: ICreateWebhookEndpointInput) => Promise<IWebhookEndpointCreatedDTO>;
	removeEndpoint: (endpointId: string) => Promise<void>;
	testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>;
}

const NONE: IWebhookEndpointDTO[] = [];

// The selected workspace's webhook endpoints — re-read on a workspace switch.
export function useWebhookEndpoints(client?: WebhooksClient): IUseWebhookEndpointsReturn {
	const webhooks = useFonderieSubClient(client, (c) => c.webhooks, 'useWebhookEndpoints');
	const q = useScopedQuery(webhooks, '/webhooks', async (bust) => (await webhooks.listEndpoints({ bust })).result.endpoints);
	const w = useWrite(q.refresh);
	// A test send changes nothing in the list, so it does not re-read here —
	// it is still a write under /webhooks, so delivery logs on screen refresh.
	const t = useWrite();
	const createEndpoint = useCallback(
		(input: ICreateWebhookEndpointInput) => w.run(async () => (await webhooks.createEndpoint(input)).result),
		[webhooks, w.run],
	);
	const removeEndpoint = useCallback(
		(endpointId: string) =>
			w.run(async () => {
				await webhooks.deleteEndpoint(endpointId);
			}),
		[webhooks, w.run],
	);
	const testEndpoint = useCallback(
		(endpointId: string) => t.run(async () => (await webhooks.testEndpoint(endpointId)).result),
		[webhooks, t.run],
	);
	return {
		endpoints: q.data ?? NONE,
		isLoading: q.isLoading,
		error: t.error ?? w.error ?? q.error,
		refresh: q.refresh,
		createEndpoint,
		removeEndpoint,
		testEndpoint,
	};
}
