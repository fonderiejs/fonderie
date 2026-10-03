import type { BillingClient, IInvoiceDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useLatestRequest, useWorkspaceSwitch } from './workspace';

export interface IUseInvoicesReturn {
	// Invoices newest first; each links out via hostedInvoiceUrl/invoicePdf.
	invoices: IInvoiceDTO[];
	// Opaque cursor for the next (older) page, or null when there is none.
	nextCursor: string | null;
	hasMore: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Appends the next page. No-op when there is no further page. A failed
	// page keeps the rows already shown and rethrows (for a toast).
	loadMore: () => Promise<void>;
}

// The subscriber's invoice history, for a billing page. Reads GET
// /billing/invoices, newest first, cursor-paginated: `loadMore` appends.
export function useInvoices(client?: BillingClient): IUseInvoicesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useInvoices');
	const [invoices, setInvoices] = useState<IInvoiceDTO[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = useWorkspaceSwitch(billing, () => {
		setInvoices([]);
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
				const { result } = await billing.listInvoices({ bust: opts?.force });
				if (!isLatest()) return;
				setInvoices(result.invoices);
				setNextCursor(result.nextCursor ?? null);
			} catch (err) {
				if (!isLatest()) return;
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				// 501 = the provider can't list invoices — a normal "no invoices" state.
				if (apiError.status !== 501) setError(apiError);
				setInvoices([]);
				setNextCursor(null);
			} finally {
				if (isLatest()) setIsLoading(false);
			}
		},
		[billing, beginRequest],
	);

	const loadMore = useCallback(async () => {
		if (!nextCursor) return;
		// A page of the previous workspace's invoices must not be appended to
		// the new workspace's list.
		const startedFor = currentWorkspace.current;
		setError(null);
		try {
			const { result } = await billing.listInvoices({ cursor: nextCursor });
			if (currentWorkspace.current !== startedFor) return;
			setInvoices((prev) => [...prev, ...result.invoices]);
			setNextCursor(result.nextCursor ?? null);
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
		invoices,
		nextCursor,
		hasMore: nextCursor !== null,
		isLoading,
		error,
		refresh,
		loadMore,
	};
}
