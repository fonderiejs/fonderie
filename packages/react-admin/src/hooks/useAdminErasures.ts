import type {
	AuthAdminClient,
	IAdminErasureDTO,
	IAdminErasureExport,
	IAdminErasuresQuery,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

export interface IUseAdminErasuresReturn {
	erasures: IAdminErasureDTO[];
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
	// Every receipt, for the auditor's evidence folder.
	exportAll: () => Promise<IAdminErasureExport | null>;
}

const asApiError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);

// Erasure receipts, newest first; with an email or phone, that person's.
export function useAdminErasures(
	client: AuthAdminClient,
	query: Omit<IAdminErasuresQuery, 'cursor'> = {},
): IUseAdminErasuresReturn {
	const [erasures, setErasures] = useState<IAdminErasureDTO[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const { limit, email, phone } = query;


	const fetchPage = useCallback(
		async (cursor?: string) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await client.listErasures({
					...(limit ? { limit } : {}),
					...(cursor ? { cursor } : {}),
					...(email ? { email } : {}),
					...(phone ? { phone } : {}),
				});
				setErasures((prev) => (cursor ? [...prev, ...result.erasures] : result.erasures));
				setNext(result.nextCursor);
			} catch (err) {
				setError(asApiError(err));
			} finally {
				setIsLoading(false);
			}
		},
		[client, limit, email, phone],
	);

	const refresh = useCallback(() => fetchPage(), [fetchPage]);
	const loadMore = useCallback(async () => {
		if (next) await fetchPage(next);
	}, [fetchPage, next]);
	const exportAll = useCallback(async () => {
		setError(null);
		try {
			return (await client.exportErasures()).result;
		} catch (err) {
			setError(asApiError(err));
			return null;
		}
	}, [client]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { erasures, hasMore: next !== null, isLoading, error, refresh, loadMore, exportAll };
}
