import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseWalletPreferencesReturn {
	// Per-subscriber toggle: when false, a debit stops at the free allowance and
	// never draws down purchased credits. null until the first read resolves; a
	// subscriber with no balance row reads the server default (true).
	spendPurchased: boolean | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	setSpendPurchased: (spendPurchased: boolean) => Promise<void>;
}

export function useWalletPreferences(client?: BillingClient): IUseWalletPreferencesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletPreferences');
	const [spendPurchased, setSpend] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(
		async (opts?: { force?: boolean }) => {
			setIsLoading(true);
			setError(null);
			try {
				const { result } = await billing.getWallet({ bust: opts?.force });
				// The DTO omits spendPurchased when no balance row exists; surface the
				// server default (spend_purchased DEFAULT true) rather than null.
				setSpend(result.wallet.spendPurchased ?? true);
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

	const setSpendPurchased = useCallback(
		async (next: boolean) => {
			setError(null);
			try {
				// The toggle route returns the refreshed wallet, so adopt it directly.
				const { result } = await billing.setWalletPreferences({ spendPurchased: next });
				setSpend(result.wallet.spendPurchased ?? next);
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[billing],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return { spendPurchased, isLoading, error, refresh, setSpendPurchased };
}
