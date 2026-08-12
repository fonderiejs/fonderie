import type { IWebhookDeliveryDTO, WebhooksClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWebhookDeliveriesReturn {
	deliveries: IWebhookDeliveryDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useWebhookDeliveries(
	client: WebhooksClient,
	endpointId: string,
): IUseWebhookDeliveriesReturn {
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
			const { result } = await client.listDeliveries(endpointId);
			setDeliveries(result.deliveries);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, endpointId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { deliveries, isLoading, error, refresh };
}
