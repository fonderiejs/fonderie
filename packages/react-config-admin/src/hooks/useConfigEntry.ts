import type { ConfigAdminClient, IConfigEntry } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseConfigEntryReturn {
	entry: IConfigEntry | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
}

export function useConfigEntry(
	client: ConfigAdminClient,
	key: string,
	environment?: string,
): IUseConfigEntryReturn {
	const [entry, setEntry] = useState<IConfigEntry | null>(null);
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
			const { result } = await client.getConfig(key, environment);
			setEntry(result);
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

	return { entry, isLoading, error, refresh };
}
