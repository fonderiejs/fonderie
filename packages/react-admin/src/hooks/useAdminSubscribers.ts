import type {
	BillingAdminClient,
	IAdminSubscriptionDTO,
	IAdminSubscriptionsQuery,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminSubscribersReturn {
	subscriptions: IAdminSubscriptionDTO[];
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
}

// Newest first; loadMore appends the next page using the server's cursor.
export function useAdminSubscribers(
	client: BillingAdminClient,
	query: Omit<IAdminSubscriptionsQuery, 'cursor'> = {},
): IUseAdminSubscribersReturn {
	const [subscriptions, setSubscriptions] = useState<IAdminSubscriptionDTO[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const limit = query.limit;

	const fetchPage = useCallback(
		async (cursor?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.listSubscriptions({
					...(limit ? { limit } : {}),
					...(cursor ? { cursor } : {}),
				});
				setSubscriptions((prev) =>
					cursor ? [...prev, ...result.subscriptions] : result.subscriptions,
				);
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

	return { subscriptions, hasMore: next !== null, isLoading, error, refresh, loadMore };
}
