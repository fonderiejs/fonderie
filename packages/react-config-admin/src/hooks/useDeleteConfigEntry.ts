import type { ConfigAdminClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useState } from 'react';

export interface IUseDeleteConfigEntryReturn {
	deleteConfigEntry: (key: string, environment?: string) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

export function useDeleteConfigEntry(client: ConfigAdminClient): IUseDeleteConfigEntryReturn {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const deleteConfigEntry = useCallback(
		async (key: string, environment?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				await client.deleteConfig(key, environment);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			} finally {
				setIsLoading(false);
			}
		},
		[client],
	);

	return { deleteConfigEntry, isLoading, error };
}
