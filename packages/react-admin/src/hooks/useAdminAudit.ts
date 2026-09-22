import type { AuditAdminClient, IAdminAuditQuery, IAuditEventDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

export interface IUseAdminAuditReturn {
	events: IAuditEventDTO[];
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
}

// What happened, across every workspace unless one is named. Newest first.
export function useAdminAudit(
	client: AuditAdminClient,
	query: Omit<IAdminAuditQuery, 'cursor'> = {},
): IUseAdminAuditReturn {
	const [events, setEvents] = useState<IAuditEventDTO[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const { workspaceId, type, actorId, from, to, limit } = query;
	const fromMs = from?.getTime();
	const toMs = to?.getTime();

	const fetchPage = useCallback(
		async (cursor?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.listAudit({
					...(workspaceId ? { workspaceId } : {}),
					...(type ? { type } : {}),
					...(actorId ? { actorId } : {}),
					...(fromMs !== undefined ? { from: new Date(fromMs) } : {}),
					...(toMs !== undefined ? { to: new Date(toMs) } : {}),
					...(limit ? { limit } : {}),
					...(cursor ? { cursor } : {}),
				});
				setEvents((prev) => (cursor ? [...prev, ...result.events] : result.events));
				setNext(result.nextCursor);
			} catch (err) {
				setError(toError(err));
			} finally {
				setIsLoading(false);
			}
		},
		[client, workspaceId, type, actorId, fromMs, toMs, limit],
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
