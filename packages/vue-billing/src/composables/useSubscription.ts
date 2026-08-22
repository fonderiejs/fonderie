import type { BillingClient, ISubscriptionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseSubscriptionReturn {
	subscription: Ref<ISubscriptionDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

export function useSubscription(client?: BillingClient): IUseSubscriptionReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useSubscription');
	const subscription = ref<ISubscriptionDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getSubscription({ bust: opts?.force });
			subscription.value = result.subscription;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			// No active subscription is a normal, expected state — not an error banner.
			if (apiError.status !== 404) error.value = apiError;
			subscription.value = null;
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());

	return { subscription, isLoading, error, refresh };
}
