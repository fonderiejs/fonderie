import type { AuthAdminClient, IAdminUserDTO, IAdminUsersQuery } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminUsersReturn {
	users: IAdminUserDTO[];
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
}

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminUsers(
	client: AuthAdminClient,
	query: Omit<IAdminUsersQuery, 'cursor'> = {},
): IUseAdminUsersReturn {
	const [users, setUsers] = useState<IAdminUserDTO[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const limit = query.limit;

	const fetchPage = useCallback(
		async (cursor?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.listUsers({
					...(limit ? { limit } : {}),
					...(cursor ? { cursor } : {}),
				});
				setUsers((prev) => (cursor ? [...prev, ...result.users] : result.users));
				setNext(result.nextCursor);
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

	return { users, hasMore: next !== null, isLoading, error, refresh, loadMore };
}
