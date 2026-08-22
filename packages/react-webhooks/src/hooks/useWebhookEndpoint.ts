import type { IUpdateWebhookEndpointInput, IWebhookEndpointDTO } from '@fonderie/client';
import { FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWebhookEndpointReturn {
	endpoint: IWebhookEndpointDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
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
	const [endpoint, setEndpoint] = useState<IWebhookEndpointDTO | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!endpointId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await webhooks.getEndpoint(endpointId);
			setEndpoint(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [webhooks, endpointId]);

	const updateEndpoint = useCallback(
		async (input: IUpdateWebhookEndpointInput) => {
			setError(null);
			try {
				const { result } = await webhooks.updateEndpoint(endpointId, input);
				setEndpoint(result);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[webhooks, endpointId],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { endpoint, isLoading, error, refresh, updateEndpoint };
}
