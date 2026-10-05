import type { BillingClient, FonderieApiError, IWalletTransactionDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { toApiError, useBillingQuery } from './workspace';

export interface IUseWalletTransactionsReturn {

	transactions: IWalletTransactionDTO[];
	// Opaque cursor for the next page, or null when there is none.
	nextCursor: string | null;
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Appends the next page. No-op when there is no further page. A failed
	// page keeps the rows already shown and rethrows (for a toast).
	loadMore: () => Promise<void>;
}

interface IPage {
	rows: IWalletTransactionDTO[];
	nextCursor: string | null;
}

const NONE: IWalletTransactionDTO[] = [];

// The wallet ledger, newest first — every credit/debit with a running
// balanceAfter. Cursor-paginated: `loadMore` appends the next page.
export function useWalletTransactions(client?: BillingClient): IUseWalletTransactionsReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletTransactions');
	// The first page is the shared, cached read: shown at once on every visit,
	// refreshed behind what is shown.
	const q = useBillingQuery<IPage>(
		billing,
		'/billing/wallet/transactions',
		async (bust) => {
			const { result } = await billing.getWalletTransactions({ bust });
			return { rows: result.transactions, nextCursor: result.nextCursor ?? null };
		},
	);

	// Pages appended by loadMore belong to THIS screen, and to the exact first
	// page they extend: a refresh that returns the same first page keeps the
	// same object (and so the extra pages); a different one (new rows, another
	// workspace) re-anchors the list instead of mixing the two.
	const [more, setMore] = useState<{ base: IPage; rows: IWalletTransactionDTO[]; cursor: string | null } | null>(null);
	const [pageError, setPageError] = useState<FonderieApiError | null>(null);
	const first = q.data;
	const firstRef = useRef(first);
	firstRef.current = first;
	const extra = more && more.base === first ? more : null;

	const rows = useMemo(
		() => (first ? (extra ? [...first.rows, ...extra.rows] : first.rows) : NONE),
		[first, extra],
	);
	const nextCursor = extra ? extra.cursor : (first?.nextCursor ?? null);

	const loadMore = useCallback(async () => {
		const base = firstRef.current;
		if (!base || !nextCursor) return;
		setPageError(null);
		try {
			const { result } = await billing.getWalletTransactions({ cursor: nextCursor });
			// The list moved on (refresh with new rows, workspace switch): this
			// page belongs to a list no longer shown.
			if (firstRef.current !== base) return;
			setMore((prev) => ({
				base,
				rows: [...(prev && prev.base === base ? prev.rows : []), ...result.transactions],
				cursor: result.nextCursor ?? null,
			}));
		} catch (err) {
			if (firstRef.current !== base) return;
			const apiError = toApiError(err);
			setPageError(apiError);
			throw apiError;
		}
	}, [billing, nextCursor]);

	return {
		transactions: rows,
		nextCursor,
		hasMore: nextCursor !== null,
		isLoading: q.isLoading,
		error: pageError ?? q.error,
		refresh: q.refresh,
		loadMore,
	};
}
