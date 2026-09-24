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
			// A 200 does not guarantee the SHAPE. /_admin/config is owned by
			// @fonderie/admin (its declared-vs-held report, an object) while this
			// client expects the config brick's array of entries — so a deployment
			// without @fonderie/config answered 200 with an object and the screen
			// died on `.map`. Refuse the wrong shape here, where it can be reported,
			// rather than handing a non-array to a component typed for one.
			const { result } = await client.listSecrets(environment);
			if (!Array.isArray(result))
				throw new FonderieApiError(
					'UNEXPECTED_SHAPE',
					'Secret list returned an unexpected shape — is @fonderie/config mounted at this prefix?',
					200,
				);
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
