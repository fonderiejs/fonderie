import type { BillingClient, FonderieApiError, IInvoiceDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { toApiError, useBillingQuery } from './workspace';

export interface IUseInvoicesReturn {
	// Invoices newest first; each links out via hostedInvoiceUrl/invoicePdf.
	invoices: IInvoiceDTO[];
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
	rows: IInvoiceDTO[];
	nextCursor: string | null;
}

const NONE: IInvoiceDTO[] = [];
const NO_INVOICES: IPage = Object.freeze({ rows: NONE, nextCursor: null }) as IPage;
// The subscriber's invoice history, for a billing page. Reads GET
// /billing/invoices, newest first, cursor-paginated: `loadMore` appends.
export function useInvoices(client?: BillingClient): IUseInvoicesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useInvoices');
	// The first page is the shared, cached read: shown at once on every visit,
	// refreshed behind what is shown.
	const q = useBillingQuery<IPage>(
		billing,
		'/billing/invoices',
		async (bust) => {
			const { result } = await billing.listInvoices({ bust });
			return { rows: result.invoices, nextCursor: result.nextCursor ?? null };
		},
		// 501 = the provider can't list invoices — a normal "no invoices" state.
		{ normal: (err) => (err.status === 501 ? NO_INVOICES : undefined) },
	);

	// Pages appended by loadMore belong to THIS screen, and to the exact first
	// page they extend: a refresh that returns the same first page keeps the
	// same object (and so the extra pages); a different one (new rows, another
	// workspace) re-anchors the list instead of mixing the two.
	const [more, setMore] = useState<{ base: IPage; rows: IInvoiceDTO[]; cursor: string | null } | null>(null);
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
			const { result } = await billing.listInvoices({ cursor: nextCursor });
			// The list moved on (refresh with new rows, workspace switch): this
			// page belongs to a list no longer shown.
			if (firstRef.current !== base) return;
			setMore((prev) => ({
				base,
				rows: [...(prev && prev.base === base ? prev.rows : []), ...result.invoices],
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
		invoices: rows,
		nextCursor,
		hasMore: nextCursor !== null,
		isLoading: q.isLoading,
		error: pageError ?? q.error,
		refresh: q.refresh,
		loadMore,
	};
}
