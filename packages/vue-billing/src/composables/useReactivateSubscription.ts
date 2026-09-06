import type { BillingClient, ISubscriptionChangeResult } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseReactivateSubscriptionReturn {
	// Un-cancel a subscription scheduled to cancel at period end. Resolves to the
	// new lifecycle state; rejects (409) if it is already fully canceled — start
	// a fresh checkout in that case.
	reactivate: () => Promise<ISubscriptionChangeResult>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useReactivateSubscription(client?: BillingClient): IUseReactivateSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useReactivateSubscription');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function reactivate(): Promise<ISubscriptionChangeResult> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.reactivateSubscription();
			return result;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return { reactivate, isLoading, error };
}
