import type { AuthAdminClient, ILoginEventDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminLoginHistoryReturn {
	events: ILoginEventDTO[];
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
}

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminLoginHistory(
	client: AuthAdminClient,
	userId: string | null,
	query: { limit?: number } = {},
): IUseAdminLoginHistoryReturn {
	const [events, setEvents] = useState<ILoginEventDTO[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const limit = query.limit;

	const fetchPage = useCallback(
		async (cursor?: string) => {
			if (!userId) {
				setEvents([]);
				setNext(null);
				return;
			}
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.userLoginHistory(userId, {
					...(limit ? { limit } : {}),
					...(cursor ? { cursor } : {}),
				});
				setEvents((prev) => (cursor ? [...prev, ...result.events] : result.events));
				setNext(result.nextCursor);
			} catch (err) {
				setError(
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0),
				);
			} finally {
				setIsLoading(false);
			}
		},
		[client, userId, limit],
	);

	const refresh = useCallback(() => fetchPage(), [fetchPage]);
	const loadMore = useCallback(async () => {
		if (next) await fetchPage(next);
	}, [fetchPage, next]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { events, hasMore: next !== null, isLoading, error, refresh, loadMore };
}
