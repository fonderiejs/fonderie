import type {
	BillingAdminClient,
	IAdminGrantInput,
	IAdminSubscriptionDTO,
	IAdminWalletDTO,
	IWalletTransactionDTO,
	SubscriberType,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import type { Ref } from 'vue';
import { computed, ref, watch } from 'vue';

// What is this subscriber on, and what does their wallet hold.
export function useAdminSubscriber(
	client: BillingAdminClient,
	subscriber: Ref<{ type: SubscriberType; id: string } | null>,
	options: { currency?: string; limit?: number } = {},
) {
	const subscription = ref<IAdminSubscriptionDTO | null>(null);
	const wallet = ref<IAdminWalletDTO | null>(null);
	const ledger = ref<IWalletTransactionDTO[]>([]);
	const next = ref<string | null>(null);
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);
	const { currency, limit } = options;
	const toError = (err: unknown) =>
		err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
	const notFound = (err: unknown) => err instanceof FonderieApiError && err.status === 404;
	const q = () => ({ ...(currency ? { currency } : {}), ...(limit ? { limit } : {}) });

	async function refresh() {
		const s = subscriber.value;
		if (!s) {
			subscription.value = null;
			wallet.value = null;
			ledger.value = [];
			next.value = null;
			return;
		}
		isLoading.value = true;
		error.value = null;
		try {
			const [sub, wal, led] = await Promise.all([
				client.subscription(s.type, s.id).then(
					(r) => r.result,
					(e) => (notFound(e) ? null : Promise.reject(e)),
				),
				client.wallet(s.type, s.id, currency).then(
					(r) => r.result,
					(e) => (notFound(e) ? null : Promise.reject(e)),
				),
				client.walletLedger(s.type, s.id, q()).then(
					(r) => r.result,
					(e) => (notFound(e) ? null : Promise.reject(e)),
				),
			]);
			subscription.value = sub;
			wallet.value = wal;
			ledger.value = led?.entries ?? [];
			next.value = led?.nextCursor ?? null;
		} catch (err) {
			error.value = toError(err);
		} finally {
			isLoading.value = false;
		}
	}

	async function loadMoreLedger() {
		const s = subscriber.value;
		if (!s || !next.value) return;
		try {
			const { result } = await client.walletLedger(s.type, s.id, { ...q(), cursor: next.value });
			ledger.value = [...ledger.value, ...result.entries];
			next.value = result.nextCursor;
		} catch (err) {
			error.value = toError(err);
		}
	}

	async function grant(input: Omit<IAdminGrantInput, 'subscriberType' | 'subscriberId'>) {
		const s = subscriber.value;
		if (!s) return;
		error.value = null;
		try {
			await client.grant({ ...input, subscriberType: s.type, subscriberId: s.id });
			await refresh();
		} catch (err) {
			const e = toError(err);
			error.value = e;
			throw e;
		}
	}

	const hasMoreLedger = computed(() => next.value !== null);
	watch(subscriber, () => void refresh(), { immediate: true, deep: true });

	return {
		subscription,
		wallet,
		ledger,
		hasMoreLedger,
		isLoading,
		error,
		refresh,
		loadMoreLedger,
		grant,
	};
}
