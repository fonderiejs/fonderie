import type { BillingClient, IWalletDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseWalletReturn {
	wallet: Ref<IWalletDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's stored-value wallet balance (GET /billing/wallet) — reflects
// the periodic grant withBilling applies on every authed request.
export function useWallet(client?: BillingClient): IUseWalletReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWallet');
	const wallet = ref<IWalletDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getWallet({ bust: opts?.force });
			wallet.value = result.wallet;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			wallet.value = null;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	return { wallet, isLoading, error, refresh };
}
