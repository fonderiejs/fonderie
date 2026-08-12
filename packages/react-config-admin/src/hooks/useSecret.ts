import type { ConfigAdminClient, ISecretEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseSecretReturn {
	secret: ISecretEntry | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useSecret(
	client: ConfigAdminClient,
	key: string,
	environment?: string,
): IUseSecretReturn {
	const [secret, setSecret] = useState<ISecretEntry | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!key) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.getSecret(key, environment);
			setSecret(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, key, environment]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { secret, isLoading, error, refresh };
}
