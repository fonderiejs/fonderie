import type { BillingClient, IPaymentMethodDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

import { latestRequest, onWorkspaceSwitch } from './workspace';

export interface IUsePaymentMethodReturn {
	paymentMethod: Ref<IPaymentMethodDTO | null>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's card on file (GET /billing/payment-method). A provider 501
// (can't retrieve one) reads as "no card", not an error.
export function usePaymentMethod(client?: BillingClient): IUsePaymentMethodReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'usePaymentMethod');
	const paymentMethod = ref<IPaymentMethodDTO | null>(null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	const beginRequest = latestRequest();

	async function refresh(opts?: { force?: boolean }) {
		const isLatest = beginRequest();
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getPaymentMethod({ bust: opts?.force });
			if (!isLatest()) return;
			paymentMethod.value = result.paymentMethod;
		} catch (err) {
			if (!isLatest()) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			if (apiError.status !== 501) error.value = apiError;
			paymentMethod.value = null;
		} finally {
			if (isLatest()) isLoading.value = false;
		}
	}

	// Workspace billing: a switch clears what was shown and re-reads.
	onWorkspaceSwitch(billing, () => {
		paymentMethod.value = null;
		error.value = null;
		isLoading.value = true;
		void refresh();
	});
	onMounted(() => void refresh());
	return { paymentMethod, isLoading, error, refresh };
}
