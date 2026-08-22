import type { ITestWebhookResult, WebhooksClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

/** @deprecated Use useWebhookDeliveries(endpointId).testEndpoint — it refreshes the delivery list after the test-send. */
export interface IUseTestWebhookEndpointReturn {
	testEndpoint: (endpointId: string) => Promise<ITestWebhookResult>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

/** @deprecated Use useWebhookDeliveries(endpointId).testEndpoint — it refreshes the delivery list after the test-send. */
export function useTestWebhookEndpoint(client?: WebhooksClient): IUseTestWebhookEndpointReturn {
	const webhooks = useFonderieSubClient(client, (c) => c.webhooks, 'useTestWebhookEndpoint');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const testEndpoint = useCallback(
		async (endpointId: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await webhooks.testEndpoint(endpointId);
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[webhooks],
	);

	return { testEndpoint, isLoading, error };
}
