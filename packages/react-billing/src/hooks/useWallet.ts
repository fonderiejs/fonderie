import type { BillingClient, FonderieApiError, IWalletDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';

import { useBillingQuery } from './workspace';

export interface IUseWalletReturn {
	// The balance snapshot. Money fields are digit strings (server bigint →
	// string); null until the first read resolves. A failed refresh keeps the
	// last balance shown and reports the error alongside it.
	wallet: IWalletDTO | null;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's stored-value wallet balance. Reads GET /billing/wallet, so
// it reflects the periodic grant withBilling applies on every authed request.
export function useWallet(client?: BillingClient): IUseWalletReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWallet');
	const q = useBillingQuery<IWalletDTO>(
		billing,
		'/billing/wallet',
		async (bust) => (await billing.getWallet({ bust })).result.wallet,
	);
	return { wallet: q.data ?? null, isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
