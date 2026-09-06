import type { BillingClient, IInvoiceDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { onMounted, ref } from 'vue';

export interface IUseInvoicesReturn {
	invoices: Ref<IInvoiceDTO[]>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
}

// The subscriber's invoice history (GET /billing/invoices) — each links out via
// hostedInvoiceUrl/invoicePdf. A provider 501 reads as an empty list.
export function useInvoices(client?: BillingClient): IUseInvoicesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useInvoices');
	const invoices = ref<IInvoiceDTO[]>([]);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.listInvoices({ bust: opts?.force });
			invoices.value = result.invoices;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			if (apiError.status !== 501) error.value = apiError;
			invoices.value = [];
		} finally {
			isLoading.value = false;
		}
	}

	onMounted(() => void refresh());
	return { invoices, isLoading, error, refresh };
}
