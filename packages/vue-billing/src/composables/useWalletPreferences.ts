import type { BillingClient, FonderieApiError, IWalletDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { computed, ref } from 'vue';

import { toApiError, useBillingQuery } from './workspace';

export interface IUseWalletPreferencesReturn {
	// Per-subscriber toggle: when false, a debit stops at the free allowance and
	// never draws down purchased credits. null until the first read resolves; a
	// subscriber with no balance row reads the server default (true).
	spendPurchased: Ref<boolean | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	setSpendPurchased: (spendPurchased: boolean) => Promise<void>;
}

export function useWalletPreferences(client?: BillingClient): IUseWalletPreferencesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletPreferences');
	// The same read as useWallet: one request serves both.
	const q = useBillingQuery<IWalletDTO>(billing, '/billing/wallet', async (bust) => (await billing.getWallet({ bust })).result.wallet);
	const writeError = ref<FonderieApiError | null>(null);

	async function setSpendPurchased(next: boolean) {
		writeError.value = null;
		try {
			// The toggle returns the refreshed wallet: every screen adopts it.
			const { result } = await billing.setWalletPreferences({ spendPurchased: next });
			q.adopt({ ...result.wallet, spendPurchased: result.wallet.spendPurchased ?? next });
		} catch (err) {
			const apiError = toApiError(err);
			writeError.value = apiError;
			throw apiError;
		}
	}

	return {
		spendPurchased: computed(() => (q.data.value ? (q.data.value.spendPurchased ?? true) : null)),
		isLoading: q.isLoading,
		error: computed(() => writeError.value ?? q.error.value),
		refresh: q.refresh,
		setSpendPurchased,
	};
}
