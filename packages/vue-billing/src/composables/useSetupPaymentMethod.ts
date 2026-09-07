import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseSetupPaymentMethodReturn {
	// Begin in-app card entry — resolves to the provider SetupIntent client secret
	// the embedded card element (Stripe Payment Element) confirms. No redirect;
	// the user never leaves the site. 501 when the provider has no in-app support.
	setup: () => Promise<string>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useSetupPaymentMethod(client?: BillingClient): IUseSetupPaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSetupPaymentMethod');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function setup(): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.setupPaymentMethod();
			return result.clientSecret;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { setup, isLoading, error };
}
