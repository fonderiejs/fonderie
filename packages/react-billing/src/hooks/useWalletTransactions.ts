import type { BillingClient, IWalletTransactionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWalletTransactionsReturn {
	transactions: IWalletTransactionDTO[];
	// Opaque cursor for the next page, or null when the ledger is exhausted.
	nextCursor: string | null;
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Appends the next page. No-op when there is no further page.
	loadMore: () => Promise<void>;
}

// The wallet ledger, newest first — every credit/debit with a running
// balanceAfter. Cursor-paginated: `loadMore` appends the next page.
export function useWalletTransactions(client?: BillingClient): IUseWalletTransactionsReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletTransactions');
	const [transactions, setTransactions] = useState<IWalletTransactionDTO[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getWalletTransactions({ bust: opts?.force });
				setTransactions(result.transactions);
				setNextCursor(result.nextCursor);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				setIsLoading(false);
			}
		},
		[billing],
	);

	const loadMore = useCallback(async () => {
		if (!nextCursor) return;
		setError(null);
		try {
			const { result } = await billing.getWalletTransactions({ cursor: nextCursor });
			setTransactions((prev) => [...prev, ...result.transactions]);
			setNextCursor(result.nextCursor);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		}
	}, [billing, nextCursor]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		transactions,
		nextCursor,
		hasMore: nextCursor !== null,
		isLoading,
		error,
		refresh,
		loadMore,
	};
}
