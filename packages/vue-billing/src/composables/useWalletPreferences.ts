import { BillingClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

import { latestRequest, onWorkspaceSwitch } from './workspace';

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
	const spendPurchased = ref<boolean | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	const beginRequest = latestRequest();

	async function refresh(opts?: { force?: boolean }) {
		const isLatest = beginRequest();
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getWallet({ bust: opts?.force });
			if (!isLatest()) return;
			// The DTO omits spendPurchased when no balance row exists; surface the
			// server default (spend_purchased DEFAULT true) rather than null.
			spendPurchased.value = result.wallet.spendPurchased ?? true;
		} catch (err) {
			if (!isLatest()) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			if (isLatest()) isLoading.value = false;
		}
	}

	// Workspace billing: a switch clears what was shown and re-reads.
	onWorkspaceSwitch(billing, () => {
		spendPurchased.value = null;
		error.value = null;
		isLoading.value = true;
		void refresh();
	});
	onMounted(() => void refresh());

	async function setSpendPurchased(next: boolean) {
		error.value = null;
		try {
			// The toggle route returns the refreshed wallet, so adopt it directly.
			const { result } = await billing.setWalletPreferences({ spendPurchased: next });
			spendPurchased.value = result.wallet.spendPurchased ?? next;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	return { spendPurchased, isLoading, error, refresh, setSpendPurchased };
}
