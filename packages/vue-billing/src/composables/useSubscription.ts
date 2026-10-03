import type { BillingClient, ISubscriptionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

import { latestRequest, onWorkspaceSwitch } from './workspace';

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

	const beginRequest = latestRequest();

	async function refresh(opts?: { force?: boolean }) {
		const isLatest = beginRequest();
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getSubscription({ bust: opts?.force });
			if (!isLatest()) return;
			subscription.value = result.subscription;
		} catch (err) {
			if (!isLatest()) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			// No active subscription is a normal, expected state — not an error banner.
			if (apiError.status !== 404) error.value = apiError;
			subscription.value = null;
		} finally {
			if (isLatest()) isLoading.value = false;
		}
	}

	// Workspace billing: a switch clears what was shown and re-reads.
	onWorkspaceSwitch(billing, () => {
		subscription.value = null;
		error.value = null;
		isLoading.value = true;
		void refresh();
	});
	onMounted(() => void refresh());

	return { subscription, isLoading, error, refresh };
}
