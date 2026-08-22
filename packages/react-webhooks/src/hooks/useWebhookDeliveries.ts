import type { IWebhookDeliveryDTO } from '@fonderie/client';
import { FonderieApiError, WebhooksClient } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWebhookDeliveriesReturn {
	deliveries: IWebhookDeliveryDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useWebhookDeliveries(endpointId: string): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	client: WebhooksClient | undefined,
	endpointId: string,
): IUseWebhookDeliveriesReturn;
export function useWebhookDeliveries(
	clientOrEndpointId: WebhooksClient | string | undefined,
	maybeEndpointId?: string,
): IUseWebhookDeliveriesReturn {
	const firstIsClient =
		clientOrEndpointId === undefined || clientOrEndpointId instanceof WebhooksClient;
	const explicit = firstIsClient ? (clientOrEndpointId as WebhooksClient | undefined) : undefined;
	const endpointId = firstIsClient ? (maybeEndpointId as string) : clientOrEndpointId;
	const webhooks = useFonderieSubClient(explicit, (c) => c.webhooks, 'useWebhookDeliveries');
	const [deliveries, setDeliveries] = useState<IWebhookDeliveryDTO[]>([]);
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
			const { result } = await webhooks.listDeliveries(endpointId);
			setDeliveries(result.deliveries);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [webhooks, endpointId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { deliveries, isLoading, error, refresh };
}
