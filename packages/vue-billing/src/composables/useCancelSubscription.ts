import type {
	BillingClient,
	ICancelSubscriptionInput,
	ISubscriptionChangeResult,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseCancelSubscriptionReturn {
	// First-party cancel — no billing-portal round-trip. Default keeps access
	// until the paid-through date; pass { atPeriodEnd: false } to end it now.
	// Resolves to the new lifecycle state.
	cancel: (input?: ICancelSubscriptionInput) => Promise<ISubscriptionChangeResult>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

export function useCancelSubscription(client?: BillingClient): IUseCancelSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useCancelSubscription');
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function cancel(input?: ICancelSubscriptionInput): Promise<ISubscriptionChangeResult> {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.cancelSubscription(input);
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

	return { cancel, isLoading, error };
}
