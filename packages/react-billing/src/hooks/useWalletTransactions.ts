import type { BillingClient, IWalletTransactionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLatestRequest, useWorkspaceSwitch } from './workspace';

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

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = useWorkspaceSwitch(billing, () => {
		setTransactions([]);
		setNextCursor(null);
		setError(null);
		setIsLoading(true);
	});
	const beginRequest = useLatestRequest();
	const currentWorkspace = useRef(workspaceId);
	currentWorkspace.current = workspaceId;

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			const isLatest = beginRequest();
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getWalletTransactions({ bust: opts?.force });
				if (!isLatest()) return;
				setTransactions(result.transactions);
				setNextCursor(result.nextCursor);
			} catch (err) {
				if (!isLatest()) return;
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
			} finally {
				if (isLatest()) setIsLoading(false);
			}
		},
		[billing, beginRequest],
	);

	const loadMore = useCallback(async () => {
		if (!nextCursor) return;
		// A page of the previous workspace's ledger must not be appended to the
		// new workspace's list.
		const startedFor = currentWorkspace.current;
		setError(null);
		try {
			const { result } = await billing.getWalletTransactions({ cursor: nextCursor });
			if (currentWorkspace.current !== startedFor) return;
			setTransactions((prev) => [...prev, ...result.transactions]);
			setNextCursor(result.nextCursor);
		} catch (err) {
			if (currentWorkspace.current !== startedFor) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		}
	}, [billing, nextCursor]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: workspaceId re-runs the read on a workspace switch
	useEffect(() => {
		void refresh();
	}, [refresh, workspaceId]);

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
