import type { BillingClient, FonderieApiError, IInvoiceDTO } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { ComputedRef, Ref } from 'vue';
import { computed, ref, shallowRef } from 'vue';

import { toApiError, useBillingQuery } from './workspace';

export interface IUseInvoicesReturn {
	invoices: Ref<IInvoiceDTO[]>;
	// Opaque cursor for the next page, or null when there is none.
	nextCursor: Ref<string | null>;
	hasMore: ComputedRef<boolean>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	// Appends the next page. No-op when there is no further page. A failed
	// page keeps the rows already shown and rethrows (for a toast).
	loadMore: () => Promise<void>;
}

interface IPage {
	rows: IInvoiceDTO[];
	nextCursor: string | null;
}

const NONE: IInvoiceDTO[] = [];
const NO_INVOICES: IPage = Object.freeze({ rows: NONE, nextCursor: null }) as IPage;
// The subscriber's invoice history (GET /billing/invoices) — each links out via
// hostedInvoiceUrl/invoicePdf. Newest first, cursor-paginated: `loadMore`
// appends. A provider 501 reads as an empty list.
export function useInvoices(client?: BillingClient): IUseInvoicesReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useInvoices');
	// The first page is the shared, cached read: shown at once on every visit.
	const q = useBillingQuery<IPage>(
		billing,
		'/billing/invoices',
		async (bust) => {
			const { result } = await billing.listInvoices({ bust });
			return { rows: result.invoices, nextCursor: result.nextCursor ?? null };
		},
		{ normal: (err) => (err.status === 501 ? NO_INVOICES : undefined) },
	);

	// Pages appended by loadMore belong to the exact first page they extend: an
	// unchanged refresh keeps the same object (and so the extra pages); a
	// different one (new rows, another workspace) re-anchors the list.
	const more = shallowRef<{ base: IPage; rows: IInvoiceDTO[]; cursor: string | null } | null>(null);
	const pageError = ref<FonderieApiError | null>(null);
	const extra = computed(() => (more.value && more.value.base === q.data.value ? more.value : null));
	const rows = computed(() => {
		const first = q.data.value;
		if (!first) return NONE;
		return extra.value ? [...first.rows, ...extra.value.rows] : first.rows;
	});
	const nextCursor = computed(() => (extra.value ? extra.value.cursor : (q.data.value?.nextCursor ?? null)));

	async function loadMore() {
		const base = q.data.value;
		const cursor = nextCursor.value;
		if (!base || !cursor) return;
		pageError.value = null;
		try {
			const { result } = await billing.listInvoices({ cursor });
			if (q.data.value !== base) return;
			const prev = more.value && more.value.base === base ? more.value.rows : [];
			more.value = { base, rows: [...prev, ...result.invoices], cursor: result.nextCursor ?? null };
		} catch (err) {
			if (q.data.value !== base) return;
			const apiError = toApiError(err);
			pageError.value = apiError;
			throw apiError;
		}
	}

	return {
		invoices: rows,
		nextCursor,
		hasMore: computed(() => nextCursor.value !== null),
		isLoading: q.isLoading,
		error: computed(() => pageError.value ?? q.error.value),
		refresh: q.refresh,
		loadMore,
	};
}
