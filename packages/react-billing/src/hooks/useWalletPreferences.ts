import type { IWalletDTO } from '@fonderie/client';
import type { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

import { toApiError, useBillingQuery } from './workspace';

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
	// The same read as useWallet: one request serves both.
	const q = useBillingQuery<IWalletDTO>(
		billing,
		'/billing/wallet',
		async (bust) => (await billing.getWallet({ bust })).result.wallet,
	);
	const [writeError, setWriteError] = useState<FonderieApiError | null>(null);

	const setSpendPurchased = useCallback(
		async (next: boolean) => {
			setWriteError(null);
			try {
				// The toggle route returns the refreshed wallet: every screen showing
				// the wallet adopts it, with no second request.
				const { result } = await billing.setWalletPreferences({ spendPurchased: next });
				q.adopt({ ...result.wallet, spendPurchased: result.wallet.spendPurchased ?? next });
			} catch (err) {
				const apiError = toApiError(err);
				setWriteError(apiError);
				throw apiError;
			}
		},
		[billing, q.adopt],
	);

	return {
		// The DTO omits spendPurchased when no balance row exists; surface the
		// server default (spend_purchased DEFAULT true) rather than null.
		spendPurchased: q.data ? (q.data.spendPurchased ?? true) : null,
		isLoading: q.isLoading,
		error: writeError ?? q.error,
		refresh: q.refresh,
		setSpendPurchased,
	};
}
