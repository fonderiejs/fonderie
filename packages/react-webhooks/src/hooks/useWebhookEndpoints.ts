import type {
	ICreateWebhookEndpointInput,
	IWebhookEndpointCreatedDTO,
	IWebhookEndpointDTO,
	WebhooksClient,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWebhookEndpointsReturn {
	endpoints: IWebhookEndpointDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	createEndpoint: (input: ICreateWebhookEndpointInput) => Promise<IWebhookEndpointCreatedDTO>;
	removeEndpoint: (endpointId: string) => Promise<void>;
}

export function useWebhookEndpoints(client: WebhooksClient): IUseWebhookEndpointsReturn {
	const [endpoints, setEndpoints] = useState<IWebhookEndpointDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listEndpoints();
			setEndpoints(result.endpoints);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client]);

	const createEndpoint = useCallback(
		async (input: ICreateWebhookEndpointInput) => {
			setError(null);
			try {
				const { result } = await client.createEndpoint(input);
				await refresh();
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	const removeEndpoint = useCallback(
		async (endpointId: string) => {
			setError(null);
			try {
				await client.deleteEndpoint(endpointId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { endpoints, isLoading, error, refresh, createEndpoint, removeEndpoint };
}
