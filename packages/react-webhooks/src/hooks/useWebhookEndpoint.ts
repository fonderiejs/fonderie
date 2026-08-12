import type {
	IUpdateWebhookEndpointInput,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWebhookEndpointReturn {
	endpoint: IWebhookEndpointDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	updateEndpoint: (input: IUpdateWebhookEndpointInput) => Promise<void>;
}

export function useWebhookEndpoint(
	client: WebhooksClient,
	endpointId: string,
): IUseWebhookEndpointReturn {
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
			const { result } = await client.getEndpoint(endpointId);
			setEndpoint(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, endpointId]);

	const updateEndpoint = useCallback(
		async (input: IUpdateWebhookEndpointInput) => {
			setError(null);
			try {
				const { result } = await client.updateEndpoint(endpointId, input);
				setEndpoint(result);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, endpointId],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { endpoint, isLoading, error, refresh, updateEndpoint };
}
