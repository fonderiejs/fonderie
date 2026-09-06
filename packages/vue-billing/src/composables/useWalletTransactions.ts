import type { BillingClient, IWalletTransactionDTO } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { ComputedRef, Ref } from 'vue';
import { computed, onMounted, ref } from 'vue';

export interface IUseWalletTransactionsReturn {
	transactions: Ref<IWalletTransactionDTO[]>;
	nextCursor: Ref<string | null>;
	hasMore: ComputedRef<boolean>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
	refresh: (opts?: { force?: boolean }) => Promise<void>;
	loadMore: () => Promise<void>;
}

// The wallet ledger, newest first — each entry carries a running balanceAfter.
// Cursor-paginated: `loadMore` appends the next page.
export function useWalletTransactions(client?: BillingClient): IUseWalletTransactionsReturn {
	const billing = useFonderieSubClient(client, (c) => c.billing, 'useWalletTransactions');
	const transactions = ref<IWalletTransactionDTO[]>([]);
	const nextCursor = ref<string | null>(null);
	const hasMore = computed(() => nextCursor.value !== null);
	const isLoading = ref(true);
	const error = ref<FonderieApiError | null>(null);

	async function refresh(opts?: { force?: boolean }) {
		isLoading.value = true;
		error.value = null;
		try {
			const { result } = await billing.getWalletTransactions({ bust: opts?.force });
			transactions.value = result.transactions;
			nextCursor.value = result.nextCursor;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
		} finally {
			isLoading.value = false;
		}
	}

	async function loadMore() {
		if (!nextCursor.value) return;
		error.value = null;
		try {
			const { result } = await billing.getWalletTransactions({ cursor: nextCursor.value });
			transactions.value = [...transactions.value, ...result.transactions];
			nextCursor.value = result.nextCursor;
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		}
	}

	onMounted(() => void refresh());
	return { transactions, nextCursor, hasMore, isLoading, error, refresh, loadMore };
}
