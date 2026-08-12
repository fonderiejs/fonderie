import type { ConfigAdminClient, ISecretEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseSecretsReturn {
	secrets: ISecretEntry[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useSecrets(client: ConfigAdminClient, environment?: string): IUseSecretsReturn {
	const [secrets, setSecrets] = useState<ISecretEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listSecrets(environment);
			setSecrets(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, environment]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { secrets, isLoading, error, refresh };
}
