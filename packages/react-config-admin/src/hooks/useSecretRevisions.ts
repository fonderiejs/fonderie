import type { ConfigAdminClient, ISecretEntry, ISecretRevision } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseSecretRevisionsReturn {
	revisions: ISecretRevision[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	rollback: (toVersion: number) => Promise<ISecretEntry>;
}

export function useSecretRevisions(
	client: ConfigAdminClient,
	key: string,
	environment?: string,
): IUseSecretRevisionsReturn {
	const [revisions, setRevisions] = useState<ISecretRevision[]>([]);
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
			const { result } = await client.listSecretRevisions(key, environment);
			setRevisions(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, key, environment]);

	const rollback = useCallback(
		async (toVersion: number) => {
			setError(null);
			try {
				const { result } = await client.rollbackSecret(key, { toVersion }, environment);
				await refresh();
				return result;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, key, environment, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { revisions, isLoading, error, refresh, rollback };
}
