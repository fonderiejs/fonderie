import type { ConfigAdminClient, ISecretEntry, ISetSecretInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseSecretsReturn {
	secrets: ISecretEntry[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	saveSecret: (key: string, input: ISetSecretInput) => Promise<ISecretEntry>;
	removeSecret: (key: string) => Promise<void>;
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

	const saveSecret = useCallback(
		async (key: string, input: ISetSecretInput) => {
			setError(null);
			try {
				const { result } = await client.setSecret(key, input, environment);
				await refresh();
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, environment, refresh],
	);

	const removeSecret = useCallback(
		async (key: string) => {
			setError(null);
			try {
				await client.deleteSecret(key, environment);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, environment, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { secrets, isLoading, error, refresh, saveSecret, removeSecret };
}
