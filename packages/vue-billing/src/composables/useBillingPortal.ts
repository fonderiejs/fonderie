import type { BillingClient } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseBillingPortalReturn {
	openPortal: () => Promise<string>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useBillingPortal(client?: BillingClient): IUseBillingPortalReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useBillingPortal');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function openPortal(): Promise<string> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.createPortalSession();
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

	return { openPortal, isLoading, error };
}
