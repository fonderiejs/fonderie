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
			// A 200 does not guarantee the SHAPE. /_admin/config is owned by
			// @fonderie/admin (its declared-vs-held report, an object) while this
			// client expects the config brick's array of entries — so a deployment
			// without @fonderie/config answered 200 with an object and the screen
			// died on `.map`. Refuse the wrong shape here, where it can be reported,
			// rather than handing a non-array to a component typed for one.
			const { result } = await client.listConfig(environment);
			if (!Array.isArray(result))
				throw new FonderieApiError(
					'UNEXPECTED_SHAPE',
					'Config list returned an unexpected shape — is @fonderie/config mounted at this prefix?',
					200,
				);
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
