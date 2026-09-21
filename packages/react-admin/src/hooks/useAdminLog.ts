import type { AdminClient, IAdminLogEntry, IAdminLogQuery } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminLogReturn {
	entries: IAdminLogEntry[];
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
}

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminLog(
	client: AdminClient,
	query: Pick<IAdminLogQuery, 'limit'> = {},
): IUseAdminLogReturn {
	const [entries, setEntries] = useState<IAdminLogEntry[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const limit = query.limit;

	const fetchPage = useCallback(
		async (before?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.adminLog({
					...(limit ? { limit } : {}),
					...(before ? { before } : {}),
				});
				setEntries((prev) => (before ? [...prev, ...result.entries] : result.entries));
				setNext(result.next);
			} catch (err) {
				setError(
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
				);
			} finally {
				setIsLoading(false);
			}
		},
		[client, limit],
	);

	const refresh = useCallback(() => fetchPage(), [fetchPage]);
	const loadMore = useCallback(async () => {
		if (next) await fetchPage(next);
	}, [fetchPage, next]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { entries, hasMore: next !== null, isLoading, error, refresh, loadMore };
}
