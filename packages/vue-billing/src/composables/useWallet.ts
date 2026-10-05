import type { BillingClient, FonderieApiError, IWalletDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed } from 'vue';

import { useBillingQuery } from './workspace';

export interface IUseWalletReturn {
	wallet: Ref<IWalletDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's stored-value wallet balance (GET /billing/wallet) — reflects
// the periodic grant withBilling applies on every authed request. A failed
// refresh keeps the last balance shown and reports the error alongside it.
export function useWallet(client?: BillingClient): IUseWalletReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWallet');
	const q = useBillingQuery<IWalletDTO>(billing, '/billing/wallet', async (bust) => (await billing.getWallet({ bust })).result.wallet);
	return { wallet: computed(() => q.data.value ?? null), isLoading: q.isLoading, error: q.error, refresh: q.refresh };
}
