import type { ConfigAdminClient, IConfigEntry, IConfigRevision } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseConfigRevisionsReturn {
	revisions: IConfigRevision[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	rollback: (toVersion: number) => Promise<IConfigEntry>;
}

export function useConfigRevisions(
	client: ConfigAdminClient,
	key: string,
	environment?: string,
): IUseConfigRevisionsReturn {
	const [revisions, setRevisions] = useState<IConfigRevision[]>([]);
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
			const { result } = await client.listConfigRevisions(key, environment);
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
				const { result } = await client.rollbackConfig(key, { toVersion }, environment);
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
