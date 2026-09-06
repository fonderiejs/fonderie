import type { BillingClient, IInvoiceDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseInvoicesReturn {
	// Invoices newest first; each links out via hostedInvoiceUrl/invoicePdf.
	invoices: IInvoiceDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's invoice history, for a billing page. Reads GET
// /billing/invoices.
export function useInvoices(client?: BillingClient): IUseInvoicesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useInvoices');
	const [invoices, setInvoices] = useState<IInvoiceDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.listInvoices({ bust: opts?.force });
				setInvoices(result.invoices);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				// 501 = the provider can't list invoices — a normal "no invoices" state.
				if (apiError.status !== 501) setError(apiError);
				setInvoices([]);
			} finally {
				setIsLoading(false);
			}
		},
		[billing],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { invoices, isLoading, error, refresh };
}
