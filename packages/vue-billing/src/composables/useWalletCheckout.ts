import type { BillingClient, IWalletCheckoutInput } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseWalletCheckoutReturn {
	// Starts a one-time credit-pack purchase; resolves to the hosted checkout URL
	// to redirect to. The wallet is credited by the payment webhook.
	checkout: (input: IWalletCheckoutInput) => Promise<string>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useWalletCheckout(client?: BillingClient): IUseWalletCheckoutReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletCheckout');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function checkout(input: IWalletCheckoutInput): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.createWalletCheckout(input);
			return result.url;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { checkout, isLoading, error };
}
