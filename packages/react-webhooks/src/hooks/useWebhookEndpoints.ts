import type {
	ICreateWebhookEndpointInput,
	ITestWebhookResult,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWebhookEndpointsReturn {
	endpoints: IWebhookEndpointDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	createEndpoint: (input: ICreateWebhookEndpointInput) => Promise<IWebhookEndpointCreatedDTO>;
	removeEndpoint: (endpointId: string) => Promise<void>;
	testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>;
}

export function useWebhookEndpoints(client?: WebhooksClient): IUseWebhookEndpointsReturn {
	const webhooks = useFonderieSubClient(client, (c) => c.webhooks, 'useWebhookEndpoints');
	const [endpoints, setEndpoints] = useState<IWebhookEndpointDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await webhooks.listEndpoints({ bust: opts?.force });
				setEndpoints(result.endpoints);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[webhooks],
	);

	const createEndpoint = useCallback(
		async (input: ICreateWebhookEndpointInput) => {
			setError(null);
			try {
				const { result } = await webhooks.createEndpoint(input);
				await refresh();
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[webhooks, refresh],
	);

	const removeEndpoint = useCallback(
		async (endpointId: string) => {
			setError(null);
			try {
				await webhooks.deleteEndpoint(endpointId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[webhooks, refresh],
	);

	// Test-sends to one endpoint from the list — a test delivery doesn't change
	// the endpoints list, so unlike the other writes there's nothing to refresh.
	// For a per-endpoint view, useWebhookDeliveries(endpointId).testEndpoint also
	// re-reads that endpoint's delivery log after the send.
	const testEndpoint = useCallback(
		async (endpointId: string) => {
			setError(null);
			try {
				const { result } = await webhooks.testEndpoint(endpointId);
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[webhooks],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { endpoints, isLoading, error, refresh, createEndpoint, removeEndpoint, testEndpoint };
}
