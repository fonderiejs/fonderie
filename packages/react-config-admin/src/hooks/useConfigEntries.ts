import type { ConfigAdminClient, IConfigEntry, ISetConfigInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseConfigEntriesReturn {
	entries: IConfigEntry[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	saveEntry: (key: string, input: ISetConfigInput) => Promise<IConfigEntry>;
	removeEntry: (key: string) => Promise<void>;
}

export function useConfigEntries(
	client: ConfigAdminClient,
	environment?: string,
): IUseConfigEntriesReturn {
	const [entries, setEntries] = useState<IConfigEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await client.listConfig(environment);
			setEntries(result);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, environment]);

	const saveEntry = useCallback(
		async (key: string, input: ISetConfigInput) => {
			setError(null);
			try {
				const { result } = await client.setConfig(key, input, environment);
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

	const removeEntry = useCallback(
		async (key: string) => {
			setError(null);
			try {
				await client.deleteConfig(key, environment);
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

	return { entries, isLoading, error, refresh, saveEntry, removeEntry };
}
