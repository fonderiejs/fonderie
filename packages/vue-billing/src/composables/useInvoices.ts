import type { BillingClient, IInvoiceDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { ComputedRef, Ref } from 'vue';
import { computed, onMounted, ref } from 'vue';

import { latestRequest, onWorkspaceSwitch } from './workspace';

export interface IUseInvoicesReturn {
	invoices: Ref<IInvoiceDTO[]>;
	// Opaque cursor for the next (older) page, or null when there is none.
	nextCursor: Ref<string | null>;
	hasMore: ComputedRef<boolean>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Appends the next page. No-op when there is no further page. A failed
	// page keeps the rows already shown and rethrows (for a toast).
	loadMore: () => Promise<void>;
}

// The subscriber's invoice history (GET /billing/invoices) — each links out via
// hostedInvoiceUrl/invoicePdf. Newest first, cursor-paginated: `loadMore`
// appends. A provider 501 reads as an empty list.
export function useInvoices(client?: BillingClient): IUseInvoicesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useInvoices');
	const invoices = ref<IInvoiceDTO[]>([]);
	const nextCursor = ref<string | null>(null);
	const hasMore = computed(() => nextCursor.value !== null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	const beginRequest = latestRequest();

	async function refresh(opts?: { force?: boolean }) {
		const isLatest = beginRequest();
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.listInvoices({ bust: opts?.force });
			if (!isLatest()) return;
			invoices.value = result.invoices;
			nextCursor.value = result.nextCursor ?? null;
		} catch (err) {
			if (!isLatest()) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			if (apiError.status !== 501) error.value = apiError;
			invoices.value = [];
			nextCursor.value = null;
		} finally {
			if (isLatest()) isLoading.value = false;
		}
	}

	async function loadMore() {
		if (!nextCursor.value) return;
		// A page of the previous workspace's invoices must not be appended to the
		// new workspace's list.
		const startedFor = workspaceId.value;
		error.value = null;
		try {
			const { result } = await billing.listInvoices({ cursor: nextCursor.value });
			if (workspaceId.value !== startedFor) return;
			invoices.value = [...invoices.value, ...result.invoices];
			nextCursor.value = result.nextCursor ?? null;
		} catch (err) {
			if (workspaceId.value !== startedFor) return;
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	// Workspace billing: a switch clears what was shown and re-reads.
	const workspaceId = onWorkspaceSwitch(billing, () => {
		invoices.value = [];
		nextCursor.value = null;
		error.value = null;
		isLoading.value = true;
		void refresh();
	});
	onMounted(() => void refresh());
	return { invoices, nextCursor, hasMore, isLoading, error, refresh, loadMore };
}
